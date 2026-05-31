import { NextRequest, NextResponse } from 'next/server'
import { db, apiProxies, requestLogs } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { decryptHybrid, type HybridEncryptedData } from '@/lib/crypto/encryption'
import {
  verifyPayment,
  settlePayment,
  buildPaymentRequirements,
  getMntAddress,
} from '@/lib/facilitator'
import { paymentNonceRepository } from '@/lib/repositories'
import type { Address } from 'viem'
import {
  validateVariables,
  substituteVariables,
  extractVariables,
  type VariableDefinition,
} from '@/features/proxy/model/variables'
import { defaultChainId } from '@/config/tokens'

type RouteParams = { params: Promise<{ id: string }> }

function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

// Timeout for proxied requests (30 seconds)
const PROXY_TIMEOUT_MS = 30_000

/**
 * Main proxy endpoint that handles x402 payments.
 *
 * Flow:
 * 1. Check if X-PAYMENT header exists
 * 2. If no payment -> return 402 with payment details
 * 3. If payment exists -> verify signature
 * 4. Proxy request to target API
 * 5. If target returns 2xx -> settle payment (transfer tokens)
 * 6. If target returns error -> return error WITHOUT charging
 */
async function handleProxyRequest(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params
  const isId = isUUID(id)
  let proxyId = id
  let status: 'success' | 'payment_failed' | 'payment_required' | 'proxy_error' | 'target_error' = 'proxy_error'
  let requesterWallet: string | null = null

  try {
    // Get proxy configuration (support both UUID and slug)
    const proxy = await db.query.apiProxies.findFirst({
      where: isId ? eq(apiProxies.id, id) : eq(apiProxies.slug, id),
    })

    if (!proxy) {
      return NextResponse.json(
        { error: 'Proxy not found' },
        { status: 404 }
      )
    }

    // Use the actual proxy ID for logging (in case we looked up by slug)
    proxyId = proxy.id

    // Get variables schema for this proxy
    const variablesSchema = proxy.variablesSchema as VariableDefinition[] | null

    // Read request body once (for non-GET requests)
    let requestBodyText: string | null = null
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      requestBodyText = await request.text()
    }

    // Extract variables from all sources (X-Variables header, query params, body)
    const url = new URL(request.url)
    const extractedVariables = extractVariables(request.headers, url.searchParams, requestBodyText ?? undefined)

    // Validate variables against schema BEFORE checking payment (no charge for invalid requests!)
    if (variablesSchema && variablesSchema.length > 0) {
      const validation = validateVariables(variablesSchema, extractedVariables)
      if (!validation.valid) {
        // Return 400 Bad Request - NO CHARGE for invalid input
        return NextResponse.json(
          {
            error: 'Variable validation failed',
            details: validation.errors,
            requiredVariables: variablesSchema.filter(v => v.required).map(v => ({
              name: v.name,
              type: v.type,
              description: v.description,
            })),
          },
          { status: 400 }
        )
      }
    }

    // Extract payment header (X-PAYMENT per Cronos x402 spec)
    const paymentHeaderValue = request.headers.get('X-PAYMENT')


    // If no payment, return 402 Payment Required (per Cronos x402 spec)
    if (!paymentHeaderValue) {
      const chainId = defaultChainId

      const paymentRequirements = buildPaymentRequirements({
        amount: BigInt(proxy.pricePerRequest),
        asset: getMntAddress(chainId),
        recipient: proxy.paymentAddress as Address,
        chainId,
        description: proxy.description ?? 'API access payment',
        mimeType: 'application/json',
        maxTimeoutSeconds: 300,
      })

      status = 'payment_required'

      // Log the request
      await logRequest(proxyId, requesterWallet, status)

      // Per x402 spec: payment requirements go in response body
      return NextResponse.json(
        { paymentRequirements },
        { status: 402 }
      )
    }

    // Verify payment signature (but don't settle yet)
    const paymentResult = await verifyPayment(
      paymentHeaderValue,
      BigInt(proxy.pricePerRequest),
      proxy.paymentAddress as Address
    )

    if (!paymentResult) {
      status = 'payment_failed'
      await logRequest(proxyId, requesterWallet, status)

      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 402 }
      )
    }

    // Extract wallet address from verified payment
    requesterWallet = paymentResult.address

    // Proxy the request to target API
    let targetResponse: {
      status: number
      statusText: string
      body: ArrayBuffer
      headers: Headers
    }

    try {
      targetResponse = await proxyToTarget(request, proxy, {
        extractedVariables,
        variablesSchema: variablesSchema ?? [],
        requestBodyText,
      })
    } catch (error) {
      console.error('[Proxy] Error forwarding request:', error)
      status = 'proxy_error'
      await logRequest(proxyId, requesterWallet, status)

      // Don't charge - proxy error is our fault
      return NextResponse.json(
        { error: 'Failed to proxy request to target' },
        { status: 502 }
      )
    }

    // Check if target API returned success (2xx)
    const isSuccess = targetResponse.status >= 200 && targetResponse.status < 300

    if (isSuccess) {
      // Target API succeeded - now settle the payment (charge the user)

      const settlement = await settlePayment(
        paymentHeaderValue,
        paymentResult.paymentHeader,
        BigInt(proxy.pricePerRequest),
        proxy.paymentAddress as Address
      )

      if (settlement) {
        // Mark nonce as used after successful settlement
        await paymentNonceRepository.consume(paymentResult.paymentNonce)

        status = 'success'
      } else {
        // Settlement failed - DO NOT return the API response (user didn't pay)
        status = 'payment_failed'
        await logRequest(proxyId, requesterWallet, status)

        return NextResponse.json(
          { error: 'Payment settlement failed. Please try again.' },
          { status: 402 }
        )
      }
    } else {
      // Target API failed - DON'T charge the user
      status = 'target_error'
    }

    await logRequest(proxyId, requesterWallet, status)

    // Return the target API response (success or error)
    return new NextResponse(targetResponse.body, {
      status: targetResponse.status,
      statusText: targetResponse.statusText,
      headers: targetResponse.headers,
    })
  } catch (error) {
    console.error('[Proxy] Unexpected error:', error)
    await logRequest(proxyId, requesterWallet, status)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface ProxyOptions {
  extractedVariables: Record<string, unknown>
  variablesSchema: VariableDefinition[]
  requestBodyText: string | null
}

interface ProxyResponse {
  status: number
  statusText: string
  body: ArrayBuffer
  headers: Headers
}

/**
 * Proxy the request to the target URL.
 * Returns the raw response data for the caller to decide what to do.
 */
async function proxyToTarget(
  request: NextRequest,
  proxy: {
    targetUrl: string
    encryptedHeaders: unknown
    httpMethod: string
    requestBodyTemplate: string | null
    queryParamsTemplate: string | null
    contentType: string | null
  },
  options: ProxyOptions
): Promise<ProxyResponse> {
  const { extractedVariables, variablesSchema, requestBodyText } = options

  // Build headers for target request
  const targetHeaders = new Headers()

  // Copy safe headers from original request
  const safeHeaders = [
    'accept',
    'accept-language',
  ]

  for (const header of safeHeaders) {
    const value = request.headers.get(header)
    if (value) {
      targetHeaders.set(header, value)
    }
  }

  // Set content type from proxy config (default to application/json)
  targetHeaders.set('content-type', proxy.contentType ?? 'application/json')

  // Decrypt and add stored headers
  if (proxy.encryptedHeaders) {
    try {
      const decryptedHeaders = decryptHybrid(proxy.encryptedHeaders as HybridEncryptedData)
      for (const [key, value] of Object.entries(decryptedHeaders)) {
        targetHeaders.set(key, value)
      }
    } catch (error) {
      console.error('[Proxy] Failed to decrypt headers:', error)
      throw new Error('Failed to decrypt proxy headers')
    }
  }

  // Build request body
  let body: BodyInit | null = null
  const method = proxy.httpMethod || request.method

  if (method !== 'GET' && method !== 'HEAD') {
    // If proxy has a request body template, use it with variable substitution
    if (proxy.requestBodyTemplate) {
      body = substituteVariables(proxy.requestBodyTemplate, extractedVariables, variablesSchema)
    } else if (requestBodyText) {
      // Power mode: forward body as-is
      body = requestBodyText
    }
  }

  // Build target URL with query params substitution if configured
  let targetUrl = proxy.targetUrl
  if (proxy.queryParamsTemplate) {
    const substitutedParams = substituteVariables(proxy.queryParamsTemplate, extractedVariables, variablesSchema)
    // queryParamsTemplate is expected to be like "foo={{bar}}&baz={{qux}}"
    const separator = targetUrl.includes('?') ? '&' : '?'
    targetUrl = `${targetUrl}${separator}${substitutedParams}`
  }

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  try {
    const targetResponse = await fetch(targetUrl, {
      method,
      headers: targetHeaders,
      body,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Build response headers (filter out hop-by-hop headers and encoding headers)
    // Note: content-encoding and content-length must be removed because:
    // 1. arrayBuffer() automatically decompresses the response body
    // 2. The original content-length is wrong after decompression
    const responseHeaders = new Headers()
    const filteredHeaders = [
      // Hop-by-hop headers
      'connection',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailers',
      'transfer-encoding',
      'upgrade',
      // Encoding headers (body is already decompressed)
      'content-encoding',
      'content-length',
    ]

    targetResponse.headers.forEach((value, key) => {
      if (!filteredHeaders.includes(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    })

    // Return raw response data
    const responseBody = await targetResponse.arrayBuffer()

    return {
      status: targetResponse.status,
      statusText: targetResponse.statusText,
      body: responseBody,
      headers: responseHeaders,
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }

    throw error
  }
}

/**
 * Log a proxy request to the database.
 */
async function logRequest(
  proxyId: string,
  requesterWallet: string | null,
  status: string
): Promise<void> {
  try {
    await db.insert(requestLogs).values({
      proxyId,
      requesterWallet,
      status,
    })
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('[Proxy] Failed to log request:', error)
  }
}

// Export handlers for all HTTP methods
export async function GET(request: NextRequest, context: RouteParams) {
  return handleProxyRequest(request, context)
}

export async function POST(request: NextRequest, context: RouteParams) {
  return handleProxyRequest(request, context)
}

export async function PUT(request: NextRequest, context: RouteParams) {
  return handleProxyRequest(request, context)
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  return handleProxyRequest(request, context)
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  return handleProxyRequest(request, context)
}

export async function OPTIONS(request: NextRequest, context: RouteParams) {
  return handleProxyRequest(request, context)
}

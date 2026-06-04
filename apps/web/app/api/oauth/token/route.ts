import { NextRequest, NextResponse } from 'next/server'
import { db, oauthAccessTokens, sessionKeys } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import {
  getOAuthClient,
  getAndValidateAuthCode,
  markAuthCodeUsed,
  verifyCodeChallenge,
  generateAccessToken,
  hashToken,
} from '@/lib/auth/oauth'
import * as bcrypt from 'bcrypt'

function parseBasicClientCredentials(authHeader: string | null): {
  clientId: string
  clientSecret: string
} | null {
  if (!authHeader?.startsWith('Basic ')) {
    return null
  }

  try {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8')
    const separatorIndex = decoded.indexOf(':')
    if (separatorIndex === -1) {
      return null
    }

    return {
      clientId: decodeURIComponent(decoded.slice(0, separatorIndex)),
      clientSecret: decodeURIComponent(decoded.slice(separatorIndex + 1)),
    }
  } catch {
    return null
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-protocol-version',
  }
}

/**
 * POST /api/oauth/token
 *
 * OAuth 2.1 token endpoint - exchanges authorization code for access token.
 *
 * Body (application/x-www-form-urlencoded or JSON):
 * - grant_type: Must be "authorization_code"
 * - code: The authorization code
 * - redirect_uri: Must match the redirect_uri used in authorization
 * - client_id: OAuth client identifier
 * - client_secret: OAuth client secret
 * - code_verifier: PKCE code verifier
 */
export async function POST(request: NextRequest) {
  // Parse body (support both form and JSON)
  let body: Record<string, string>
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData()
    body = Object.fromEntries(formData.entries()) as Record<string, string>
  } else {
    body = await request.json()
  }

  const basicCredentials = parseBasicClientCredentials(request.headers.get('authorization'))

  const {
    grant_type: grantType,
    code,
    redirect_uri: redirectUri,
    client_id: bodyClientId,
    client_secret: bodyClientSecret,
    code_verifier: codeVerifier,
  } = body
  const clientId = bodyClientId || basicCredentials?.clientId
  const clientSecret = bodyClientSecret || basicCredentials?.clientSecret

  console.log('[POST /api/oauth/token] Incoming token exchange request:', {
    grantType,
    clientId: clientId || null,
    codePresent: Boolean(code),
    redirectUri: redirectUri || null,
    codeVerifierPresent: Boolean(codeVerifier),
    authMethod: basicCredentials ? 'client_secret_basic' : 'client_secret_post',
    contentType,
    userAgent: request.headers.get('user-agent') || null,
    referer: request.headers.get('referer') || null,
  })

  // Validate grant type
  if (grantType !== 'authorization_code') {
    console.log('[POST /api/oauth/token] Unsupported grant type:', { grantType })
    return NextResponse.json({
      error: 'unsupported_grant_type',
      error_description: 'Only authorization_code grant type is supported',
    }, { status: 400, headers: corsHeaders() })
  }

  // Validate required params
  if (!code) {
    console.log('[POST /api/oauth/token] Missing authorization code')
    return NextResponse.json({
      error: 'invalid_request',
      error_description: 'Missing authorization code',
    }, { status: 400, headers: corsHeaders() })
  }
  if (!clientId) {
    console.log('[POST /api/oauth/token] Missing client_id')
    return NextResponse.json({
      error: 'invalid_request',
      error_description: 'Missing client_id',
    }, { status: 400, headers: corsHeaders() })
  }
  if (!clientSecret) {
    console.log('[POST /api/oauth/token] Missing client_secret', { clientId })
    return NextResponse.json({
      error: 'invalid_request',
      error_description: 'Missing client_secret',
    }, { status: 400, headers: corsHeaders() })
  }
  if (!codeVerifier) {
    console.log('[POST /api/oauth/token] Missing code_verifier', { clientId })
    return NextResponse.json({
      error: 'invalid_request',
      error_description: 'Missing code_verifier (PKCE required)',
    }, { status: 400, headers: corsHeaders() })
  }

  // Get and validate client
  const client = await getOAuthClient(clientId)
  if (!client) {
    console.log('[POST /api/oauth/token] Unknown client:', { clientId })
    return NextResponse.json({
      error: 'invalid_client',
      error_description: 'Unknown client',
    }, { status: 401, headers: corsHeaders() })
  }

  // Verify client secret
  const secretValid = await bcrypt.compare(clientSecret, client.secretHash)
  if (!secretValid) {
    console.log('[POST /api/oauth/token] Invalid client credentials:', { clientId })
    return NextResponse.json({
      error: 'invalid_client',
      error_description: 'Invalid client credentials',
    }, { status: 401, headers: corsHeaders() })
  }

  // Get and validate authorization code
  const authCode = await getAndValidateAuthCode(code, clientId)
  if (!authCode) {
    console.log('[POST /api/oauth/token] Invalid or expired authorization code:', { clientId, codePresent: Boolean(code) })
    return NextResponse.json({
      error: 'invalid_grant',
      error_description: 'Invalid or expired authorization code',
    }, { status: 400, headers: corsHeaders() })
  }

  // Verify redirect URI matches
  if (redirectUri && authCode.redirectUri !== redirectUri) {
    console.log('[POST /api/oauth/token] Redirect URI mismatch:', {
      clientId,
      redirectUri,
      storedRedirectUri: authCode.redirectUri,
    })
    return NextResponse.json({
      error: 'invalid_grant',
      error_description: 'Redirect URI mismatch',
    }, { status: 400, headers: corsHeaders() })
  }

  // Verify PKCE code challenge
  if (!verifyCodeChallenge(codeVerifier, authCode.codeChallenge)) {
    console.log('[POST /api/oauth/token] Invalid code_verifier:', { clientId })
    return NextResponse.json({
      error: 'invalid_grant',
      error_description: 'Invalid code_verifier',
    }, { status: 400, headers: corsHeaders() })
  }

  // Get the session linked to this authorization
  const sessionId = authCode.sessionConfig.sessionId
  if (!sessionId) {
    console.log('[POST /api/oauth/token] No session linked to authorization:', { clientId, codePresent: Boolean(code) })
    return NextResponse.json({
      error: 'invalid_grant',
      error_description: 'No session linked to this authorization',
    }, { status: 400, headers: corsHeaders() })
  }

  const session = await db.query.sessionKeys.findFirst({
    where: and(
      eq(sessionKeys.sessionId, sessionId),
      eq(sessionKeys.userId, authCode.userId),
      eq(sessionKeys.isActive, true)
    ),
  })

  if (!session) {
    console.log('[POST /api/oauth/token] Linked session missing/inactive:', {
      clientId,
      userId: authCode.userId,
      sessionId,
    })
    return NextResponse.json({
      error: 'invalid_grant',
      error_description: 'Linked session not found or inactive',
    }, { status: 400, headers: corsHeaders() })
  }

  // Mark authorization code as used (one-time use)
  await markAuthCodeUsed(code)

  // Generate access token
  const accessToken = generateAccessToken()
  const tokenHash = hashToken(accessToken)
  const now = new Date()

  // Give the OAuth access token a longer client-visible lifetime so the
  // MCP client does not treat the connection as expired too early.
  // Session validation still happens server-side on every request, so the
  // token cannot outlive the actual on-chain/session authorization.
  const tokenTtlMs = 30 * 24 * 60 * 60 * 1000 // 30 days
  const expiresAt = new Date(now.getTime() + tokenTtlMs)

  // Create access token record
  const [tokenRecord] = await db.insert(oauthAccessTokens).values({
    tokenHash,
    clientId,
    userId: authCode.userId,
    sessionKeyId: session.id,
    scopes: authCode.approvedScopes,
    mcpSlug: authCode.sessionConfig.mcpSlug, // Include MCP slug if present
    expiresAt,
  }).returning()

  console.log('[POST /api/oauth/token] Access token issued:', {
    clientId,
    userId: authCode.userId,
    sessionId: session.sessionId,
    scopes: authCode.approvedScopes,
    mcpSlug: authCode.sessionConfig.mcpSlug || null,
    expiresAt: expiresAt.toISOString(),
  })

  // Return OAuth 2.0 token response
  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
    scope: authCode.approvedScopes.join(' '),
    // Additional info for client convenience
    session_id: session.sessionId,
    wallet_address: (await db.query.users.findFirst({
      where: eq((await import('@/lib/db')).users.id, authCode.userId),
    }))?.walletAddress,
  }, { headers: corsHeaders() })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  })
}

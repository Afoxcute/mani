import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /.well-known/oauth-protected-resource
 *
 * OAuth 2.0 Protected Resource Metadata (RFC 9470)
 * https://datatracker.ietf.org/doc/html/rfc9470
 *
 * Describes the protected resource (MCP server) and its authorization requirements.
 */
export async function GET(request: NextRequest) {
  const resourceUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  // Use MCP_PUBLIC_URL for the resource (subdomain for direct client access)
  const mcpServerUrl = process.env.MCP_PUBLIC_URL || 'http://localhost:3001'

  let mcpSlug: string | null = null
  const referer = request.headers.get('referer') || request.headers.get('origin')
  if (referer) {
    const match = referer.match(/\/mcp\/([^\/\?]+)/)
    if (match) {
      mcpSlug = match[1]
    }
  }

  const metadata = {
    // The protected resource identifier (public URL for direct client access)
    resource: mcpServerUrl,

    // Authorization servers that can be used to obtain tokens
    authorization_servers: [mcpSlug ? `${resourceUrl}/oauth/${mcpSlug}` : resourceUrl],

    // Scopes required for accessing this resource
    scopes_supported: ['x402:payments', 'mcp:tools', 'workflow:token-approvals'],

    // Bearer token authentication
    bearer_methods_supported: ['header'],

    // Resource documentation
    resource_documentation: `${resourceUrl}/docs/mcp`,
  }

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-protocol-version',
    },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-protocol-version',
    },
  })
}

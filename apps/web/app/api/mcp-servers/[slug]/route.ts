import { NextRequest, NextResponse } from 'next/server'
import { db, mcpServers, mcpServerTools, mcpServerWorkflows, apiProxies, workflowTemplates, users } from '@/lib/db'
import { eq, and, asc } from 'drizzle-orm'

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * GET /api/mcp-servers/[slug]
 *
 * Get a public MCP server by slug with its tools and workflows
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const requestUrl = new URL(request.url)
    const webOrigin = requestUrl.origin

    // Get MCP server with owner info
    const server = await db
      .select({
        id: mcpServers.id,
        slug: mcpServers.slug,
        name: mcpServers.name,
        description: mcpServers.description,
        isPublic: mcpServers.isPublic,
        createdAt: mcpServers.createdAt,
        updatedAt: mcpServers.updatedAt,
        ownerWallet: users.walletAddress,
      })
      .from(mcpServers)
      .innerJoin(users, eq(mcpServers.userId, users.id))
      .where(and(eq(mcpServers.slug, slug), eq(mcpServers.isPublic, true)))
      .limit(1)

    if (server.length === 0) {
      return NextResponse.json({ error: 'MCP server not found' }, { status: 404 })
    }

    const mcpServer = server[0]

    // Get tools with their proxies
    const tools = await db
      .select({
        id: mcpServerTools.id,
        toolName: mcpServerTools.toolName,
        toolDescription: mcpServerTools.toolDescription,
        shortDescription: mcpServerTools.shortDescription,
        isEnabled: mcpServerTools.isEnabled,
        displayOrder: mcpServerTools.displayOrder,
        apiProxy: {
          id: apiProxies.id,
          slug: apiProxies.slug,
          name: apiProxies.name,
          description: apiProxies.description,
          pricePerRequest: apiProxies.pricePerRequest,
          category: apiProxies.category,
          httpMethod: apiProxies.httpMethod,
        },
      })
      .from(mcpServerTools)
      .innerJoin(apiProxies, eq(mcpServerTools.apiProxyId, apiProxies.id))
      .where(and(eq(mcpServerTools.mcpServerId, mcpServer.id), eq(mcpServerTools.isEnabled, true)))
      .orderBy(asc(mcpServerTools.displayOrder))

    // Get workflows
    const workflows = await db
      .select({
        id: mcpServerWorkflows.id,
        toolName: mcpServerWorkflows.toolName,
        toolDescription: mcpServerWorkflows.toolDescription,
        isEnabled: mcpServerWorkflows.isEnabled,
        displayOrder: mcpServerWorkflows.displayOrder,
        workflow: {
          id: workflowTemplates.id,
          slug: workflowTemplates.slug,
          name: workflowTemplates.name,
          description: workflowTemplates.description,
          inputSchema: workflowTemplates.inputSchema,
        },
      })
      .from(mcpServerWorkflows)
      .innerJoin(workflowTemplates, eq(mcpServerWorkflows.workflowId, workflowTemplates.id))
      .where(and(eq(mcpServerWorkflows.mcpServerId, mcpServer.id), eq(mcpServerWorkflows.isEnabled, true)))
      .orderBy(asc(mcpServerWorkflows.displayOrder))

    // Build connection URL. Prefer the actual public MCP URL, then client-visible fallback.
    const envMcpPublicUrl = process.env.MCP_PUBLIC_URL?.trim() || null
    const envNextPublicMcpUrl = process.env.NEXT_PUBLIC_MCP_URL?.trim() || null
    const placeholderPatterns = ['yourdomain.com', 'localhost:3001', '127.0.0.1:3001']
    const isPlaceholder = (value: string | null) =>
      !value || placeholderPatterns.some(pattern => value.includes(pattern))

    const mcpBaseUrl =
      !isPlaceholder(envMcpPublicUrl) ? envMcpPublicUrl
      : !isPlaceholder(envNextPublicMcpUrl) ? envNextPublicMcpUrl
      : null

    const resolvedMcpBaseUrl = mcpBaseUrl ?? 'http://localhost:3001'
    const connectionUrl = `${resolvedMcpBaseUrl}/mcp/${mcpServer.slug}`

    console.log('[GET /api/mcp-servers/[slug]] Connection URL resolved:', {
      slug,
      webOrigin,
      envMcpPublicUrl: envMcpPublicUrl || null,
      envNextPublicMcpUrl: envNextPublicMcpUrl || null,
      resolvedMcpBaseUrl: resolvedMcpBaseUrl,
      connectionUrl,
    })

    return NextResponse.json({
      server: {
        id: mcpServer.id,
        slug: mcpServer.slug,
        name: mcpServer.name,
        description: mcpServer.description,
        ownerWallet: mcpServer.ownerWallet,
        createdAt: mcpServer.createdAt.toISOString(),
        updatedAt: mcpServer.updatedAt.toISOString(),
        connectionUrl,
      },
      tools: tools.map((t) => ({
        id: t.id,
        name: t.toolName || t.apiProxy.name,
        description: t.toolDescription || t.apiProxy.description,
        shortDescription: t.shortDescription,
        apiProxy: {
          id: t.apiProxy.id,
          slug: t.apiProxy.slug,
          name: t.apiProxy.name,
          pricePerRequest: t.apiProxy.pricePerRequest,
          category: t.apiProxy.category,
          httpMethod: t.apiProxy.httpMethod,
        },
      })),
      workflows: workflows.map((w) => ({
        id: w.id,
        name: w.toolName || w.workflow.name,
        description: w.toolDescription || w.workflow.description,
        workflow: {
          id: w.workflow.id,
          slug: w.workflow.slug,
          name: w.workflow.name,
          inputSchema: w.workflow.inputSchema,
        },
      })),
    })
  } catch (error) {
    console.error('[GET /api/mcp-servers/[slug]] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

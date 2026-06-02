# x402 MCP Server

Express.js server implementing the Model Context Protocol (MCP) for AI agent integration. Exposes marketplace APIs and workflows as MCP tools that AI agents can discover and execute.

## Features

- **MCP Protocol** - Streamable HTTP transport with session management
- **OAuth 2.0** - Protected resource with RFC 8414/9470 metadata discovery
- **Proxy Tools** - Wrap marketplace APIs as MCP tools with x402 payment handling
- **Workflow Tools** - Execute multi-step workflows (HTTP calls + on-chain transactions)
- **Multi-tenant** - Slug-based routing for multiple MCP server configurations

## Environment Setup

The MCP server shares environment variables with the web app. Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (shared with web) |
| `REDIS_URL` | Redis connection string (optional) |
| `NEXT_APP_URL` | URL of the web app (default: `http://localhost:3000`) |
| `MCP_PUBLIC_URL` | Public URL where this MCP server is accessible (e.g., `https://mcp.yourdomain.com`) - used in OAuth metadata and WWW-Authenticate headers |
| `PORT` | Server port (default: `3001`) |
| `CHAIN_ID` | Cronos chain ID - `338` testnet, `25` mainnet |
| `SERVER_PRIVATE_KEY` | RSA private key for decrypting session keys |
| `MCP_CLIENT_SECRET` | OAuth client secret for the MCP platform client |

## Running

```bash
# Development (port 3001)
pnpm dev

# Production build
pnpm build
pnpm start
```

## Docker

Build from the repository root:

```bash
docker build -f Dockerfile.mcp -t bottie-mcp .
```

Run the container:

```bash
docker run --rm -p 3001:3001 \
  -e DATABASE_URL=postgres://... \
  -e REDIS_URL=redis://... \
  -e NEXT_APP_URL=http://host.docker.internal:3000 \
  -e MCP_PUBLIC_URL=https://your-mcp-domain.com \
  -e SERVER_PRIVATE_KEY=... \
  -e MCP_CLIENT_SECRET=... \
  -e CHAIN_ID=5003 \
  bottie-mcp
```

Notes:
- The container listens on `PORT=3001`.
- `NEXT_APP_URL` should point at the web app reachable from the container.
- `MCP_PUBLIC_URL` should be the externally reachable URL of the MCP server when you deploy it behind a proxy.

## GitHub Actions Deploy to Ubuntu

The included workflow at [/.github/workflows/mcp-docker.yml](/C:/Users/XPS/mani/.github/workflows/mcp-docker.yml) SSHes into an Ubuntu server and runs the same Docker build and restart flow.

Required GitHub secrets:
- `MCP_SSH_HOST`
- `MCP_SSH_USER`
- `MCP_SSH_KEY`
- `MCP_SSH_PORT` (optional, defaults to `22`)
- `MCP_DEPLOY_PATH` (absolute path to the repo root on the Ubuntu server)
- `MCP_ENV_FILE` (optional, defaults to `/opt/mani/apps/mcp-server/.env`)
- `MCP_CONTAINER_NAME` (optional, defaults to `bottie-mcp`)
- `MCP_IMAGE_NAME` (optional, defaults to `bottie-mcp`)
- `MCP_HOST_PORT` (optional, defaults to `3001`)

Ubuntu server prerequisites:
- Docker is installed and the deploy user can run it
- The repo is already cloned at `MCP_DEPLOY_PATH`
- The server env file exists at `MCP_ENV_FILE`
- That env file contains `DATABASE_URL`, `SERVER_PRIVATE_KEY`, `MCP_CLIENT_SECRET`, and the other runtime variables listed above
- The server can reach the database and Redis from its network

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /mcp/:slug` | MCP JSON-RPC endpoint |
| `GET /mcp/:slug` | SSE streaming for MCP sessions |
| `DELETE /mcp/:slug` | Terminate MCP session |
| `GET /.well-known/oauth-authorization-server` | OAuth metadata |
| `GET /.well-known/oauth-protected-resource` | Protected resource metadata |
| `GET /mcp/:slug/.well-known/*` | Slug-specific OAuth discovery |

## Local Testing with Tunnels

For testing with external MCP clients, expose the server via cloudflared:

```bash
cloudflared tunnel --url http://localhost:3001
```

## Architecture

```
src/
├── server.ts       # Express app setup and MCP session handling
├── index.ts        # Server entry point
├── auth/           # OAuth token validation
├── tools/          # Tool registry and handlers
│   ├── registry.ts      # Load tools from database
│   ├── proxy-tool.ts    # API proxy tool factory
│   └── workflow-tool.ts # Workflow tool factory
└── workflows/      # Workflow execution engine
    ├── engine.ts        # Core workflow executor
    ├── resolver.ts      # JSONPath expression resolution
    └── steps/           # Step type handlers (http, onchain)
```

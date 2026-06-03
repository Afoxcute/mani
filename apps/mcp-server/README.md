# mani MCP Server

Express-based MCP server for the mani platform.

It exposes marketplace APIs and workflows as MCP tools so AI agents can discover and execute them through a standard protocol.

## What it does

- Serves MCP tools for APIs and workflows
- Supports OAuth discovery for MCP clients
- Uses the mani database to resolve tools and workflows
- Works with the x402 marketplace and session key flows

## Environment

The server loads environment variables from `apps/mcp-server/.env.local` and `apps/mcp-server/.env` when present.

Required:

- `DATABASE_URL`
- `SERVER_PRIVATE_KEY`
- `MCP_CLIENT_SECRET`

Recommended:

- `NEXT_APP_URL` - public URL of the mani web app
- `MCP_PUBLIC_URL` - public URL of the MCP server
- `REDIS_URL` - optional shared nonce/session storage
- `CHAIN_ID` - use `5003` for Mantle Sepolia
- `PORT` - defaults to `3001`
- `WORKFLOW_DEBUG` - optional debug logging

## Run locally

```bash
pnpm --filter mcp-server dev
```

## Build

```bash
pnpm --filter mcp-server build
```

## Start

```bash
pnpm --filter mcp-server start
```

## Docker

Build from the repository root:

```bash
docker build -f Dockerfile.mcp -t mani-mcp .
```

Run the container:

```bash
docker run --rm -p 3001:3001 \
  -e DATABASE_URL=postgres://... \
  -e REDIS_URL=redis://... \
  -e NEXT_APP_URL=https://your-web-app.example.com \
  -e MCP_PUBLIC_URL=https://your-mcp-server.example.com \
  -e SERVER_PRIVATE_KEY=... \
  -e MCP_CLIENT_SECRET=... \
  -e CHAIN_ID=5003 \
  mani-mcp
```

## GitHub Actions deployment

The workflow at [/.github/workflows/mcp-docker.yml](/C:/Users/XPS/mani/.github/workflows/mcp-docker.yml) now deploys both the web app and the MCP server:

- builds `Dockerfile.web` and `Dockerfile.mcp`
- pushes the images to Docker Hub
- SSHes into the Ubuntu server
- pulls the latest web and MCP images
- restarts both containers with Docker

Required GitHub secrets:

- `DOCKER_USERNAME_PROD`
- `DOCKER_HUB_ACCESS_TOKEN_PROD`
- `SSH_HOST_TEMP`
- `SSH_USERNAME_TEMP`
- `SSH_PRIVATE_TEMP`
- `NEXT_PUBLIC_REOWN_PROJECT_ID_PROD`
- `NEXT_PUBLIC_X402_FACILITATOR_URL_PROD`
- `NEXT_PUBLIC_APP_URL_PROD`
- `NEXT_PUBLIC_MCP_URL_PROD`
- `NEXT_PUBLIC_MANTLE_SEPOLIA_AGENT_DELEGATOR_ADDRESS_PROD`
- `NEXT_PUBLIC_MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS_PROD`

Ubuntu server env files:

- `/home/ubuntu/bottie/.env.web`
- `/home/ubuntu/bottie/.env.mcp`

The web env file should contain the runtime values for the Next.js app.

The MCP env file should contain:

- `DATABASE_URL`
- `SERVER_PRIVATE_KEY`
- `MCP_CLIENT_SECRET`
- `NEXT_APP_URL`
- `MCP_PUBLIC_URL`
- `CHAIN_ID=5003`

The web container is deployed as `mani-web` on port `3000`, and the MCP container is deployed as `mani-mcp` on port `3001`.

## API endpoints

- `GET /health`
- `POST /mcp/:slug`
- `GET /mcp/:slug`
- `DELETE /mcp/:slug`
- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/oauth-protected-resource`

## Notes for submission

- The MCP server should be deployed on a public host.
- Set `MCP_PUBLIC_URL` to the public URL, not localhost.
- Link the public MCP URL in your DoraHacks submission if you expose it as part of the demo.

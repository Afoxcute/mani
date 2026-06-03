# mani Web App

Next.js frontend and API backend for the mani x402 marketplace on Mantle Sepolia.

This app lets you:

- create paid API proxies
- view request activity and earnings
- build reusable workflows
- manage MCP server exposure for AI agents
- enable ERC-7702 smart accounts and session keys

## Current chain and deployment model

- Chain: Mantle Sepolia
- Chain ID: `5003`
- Payment token: MNT
- Smart account / delegation flow: `AgentDelegator`
- Visible on-chain router: `ActionRouter`

The deployed contracts currently wired in source are:

- `AgentDelegator`
  - `0x3A9AB777B438d78059D1735c3ec30e6c94Ea35a1`
- `ActionRouter`
  - `0x288dA822f469B9e11818dB9fA6EC74e57230342a`

## Features

- Wallet authentication with Reown AppKit
- API marketplace with x402 payment gating
- MCP server management
- Workflow builder for HTTP + on-chain automation
- Session keys for bounded AI execution

## Environment setup

Copy the example env first:

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Reown project ID |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SESSION_SECRET` | 32+ character secret |
| `SERVER_PUBLIC_KEY` | RSA public key for header encryption |
| `SERVER_PRIVATE_KEY` | RSA private key for header encryption |
| `MCP_PUBLIC_URL` | Public URL of the MCP server |
| `NEXT_PUBLIC_MCP_URL` | Public MCP server URL used by the client |
| `NEXT_PUBLIC_X402_FACILITATOR_URL` | Public URL of the facilitator service |

Recommended production values:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Public frontend URL, not localhost |
| `NEXT_PUBLIC_MANTLE_SEPOLIA_AGENT_DELEGATOR_ADDRESS` | Optional override for the deployed AgentDelegator |
| `NEXT_PUBLIC_MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS` | Optional override for the deployed ActionRouter |

## Run locally

```bash
pnpm dev
```

## Build

```bash
pnpm build
pnpm start
```

## Docker

Build from the repository root:

```bash
docker build -f Dockerfile.web -t mani-web .
```

The Docker image accepts the public build-time values used by the client bundle:

- `NEXT_PUBLIC_REOWN_PROJECT_ID`
- `NEXT_PUBLIC_X402_FACILITATOR_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_MCP_URL`
- `NEXT_PUBLIC_MANTLE_SEPOLIA_CHAIN_ID`
- `NEXT_PUBLIC_MANTLE_SEPOLIA_AGENT_DELEGATOR_ADDRESS`
- `NEXT_PUBLIC_MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS`

At runtime, the container still needs the standard server env file values:

- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET`
- `SERVER_PUBLIC_KEY`
- `SERVER_PRIVATE_KEY`
- `MCP_PUBLIC_URL`
- `NEXT_PUBLIC_X402_FACILITATOR_URL`

The combined GitHub Actions workflow now deploys the web app as `mani-web` on port `3000`.

## Database commands

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

## Architecture

```text
app/           Next.js pages and route handlers
features/      UI and state management by domain
lib/           Shared auth, DB, facilitator, and payment utilities
components/    Shared UI components
```

## Submission notes

- The final demo should be hosted at a public URL, not localhost.
- Include the deployed contract addresses in your DoraHacks submission.
- Include a demo video link in the submission.
- The repo already documents the on-chain deployment and architecture.

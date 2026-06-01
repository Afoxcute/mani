# Facilitator Service

Standalone x402 facilitator for Mantle Sepolia.

## What it exposes

- `GET /health`
- `POST /verify`
- `POST /settle`
- The same endpoints are also available at:
  - `/api/facilitator/verify`
  - `/api/facilitator/settle`

## Environment

Required:

- `FACILITATOR_RELAYER_KEY`

Optional:

- `PORT` - defaults to `3002`
- `REDIS_URL` - enables shared nonce storage; falls back to memory if unset or unavailable
- `MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS` - routes visible settlement txs through your deployed router contract

## Run locally

From the repo root:

```bash
pnpm --filter facilitator dev
```

## Build

```bash
pnpm --filter facilitator build
```

## Start

```bash
pnpm --filter facilitator start
```

## Use from the web app

Point any x402 client or protected API flow at the service base URL, for example:

```bash
NEXT_PUBLIC_X402_FACILITATOR_URL=https://your-facilitator.example.com
```

This service is configured for Mantle Sepolia and will fall back to the existing AgentDelegator address until you set the router env var above.

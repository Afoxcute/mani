# mani Facilitator Service

Standalone x402 facilitator for mani on Mantle Sepolia.

This service handles:

- payment verification
- payment settlement
- nonce protection
- relayer broadcasting for the x402 flow

## Endpoints

- `GET /health`
- `POST /verify`
- `POST /settle`
- `POST /api/facilitator/verify`
- `POST /api/facilitator/settle`

## Environment

Required:

- `FACILITATOR_RELAYER_KEY`

Recommended:

- `PORT` - defaults to `3002`
- `REDIS_URL` - shared nonce storage, optional but recommended
- `NEXT_PUBLIC_X402_FACILITATOR_URL` - set in the web app, not here
- `MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS` - routes settlement through the deployed router contract

## Run locally

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

## Docker

If you run it in Docker, the container should be started with an env file that includes the required variables above.

## Web app integration

Set the web app facilitator URL to the public base URL of this service:

```env
NEXT_PUBLIC_X402_FACILITATOR_URL=https://your-facilitator.example.com
```

Do not use `localhost` in the final demo deployment.


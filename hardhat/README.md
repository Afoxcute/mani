# mani Contracts

This package contains the smart contracts, deployment modules, and verification tooling for the current Mantle Sepolia deployment.

## Live deployments

Current live Mantle Sepolia contracts:

- `AgentDelegator`
  - `0x3A9AB777B438d78059D1735c3ec30e6c94Ea35a1`
  - Sourcify: https://sourcify.dev/server/repo-ui/5003/0x3A9AB777B438d78059D1735c3ec30e6c94Ea35a1
- `ActionRouter`
  - `0x288dA822f469B9e11818dB9fA6EC74e57230342a`
  - Sourcify: https://sourcify.dev/server/repo-ui/5003/0x288dA822f469B9e11818dB9fA6EC74e57230342a

These are the addresses currently wired through the mani source code.

## What each contract does

- `AgentDelegator`
  - ERC-7702 delegation
  - session key management
  - `grantSession(...)`
  - `executeWithSession(...)`
- `ActionRouter`
  - extends `AgentDelegator`
  - keeps the same smart-account logic
  - adds a visible settlement entrypoint for app interactions

## Setup

```bash
pnpm install
```

Set `HACKATHON_KEY` in `hardhat/.env` or your shell before deploying.

## Deploy

```bash
npx hardhat ignition deploy ignition/modules/AgentDelegator.ts --network mantleSepolia
npx hardhat ignition deploy ignition/modules/ActionRouter.ts --network mantleSepolia
```

## Verify

The repo is configured to verify on Mantle Sepolia. If the Mantle Explorer API key is set, Hardhat will use it. If not, Sourcify verification still succeeds.

Example:

```bash
npx hardhat verify --network mantleSepolia 0x3A9AB777B438d78059D1735c3ec30e6c94Ea35a1
npx hardhat verify --network mantleSepolia 0x288dA822f469B9e11818dB9fA6EC74e57230342a
```

Required env for explorer verification:

- `MANTLE_SEPOLIA_EXPLORER_API_KEY` - optional, used for Mantle Explorer verification

## Scripts

Helpful scripts in this package:

- `scripts/enable-smart-account.ts`
- `scripts/test-agent-delegator.ts`
- `scripts/full-agent-delegator-flow.ts`

Run them with:

```bash
PRIVATE_KEY=0x... npx hardhat run scripts/full-agent-delegator-flow.ts --network mantleSepolia
```

## Legacy deployments

The repo still contains older deployment artifacts for reference:

- Cronos mainnet
- older test deployment entries

The active production path for mani is Mantle Sepolia.


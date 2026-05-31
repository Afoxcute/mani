import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;

  const contents = readFileSync(path, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), "hardhat", ".env"));

const deployerKey = process.env.HACKATHON_KEY;
if (!deployerKey) {
  throw new Error(
    'HACKATHON_KEY is not set. Add it to hardhat/.env or export it in your shell before running Hardhat.'
  );
}

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.29",
        settings: {
          evmVersion: "prague",
        },
      },
      production: {
        version: "0.8.29",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: "prague",
        },
      },
    },
  },

  networks: {
    mantleSepolia: {
      type: "http",
      chainType: "l1",
      url: "https://rpc.sepolia.mantle.xyz",
      chainId: 5003,
      accounts: [deployerKey],
    },
    cronosMainnet: {
      type: "http",
      chainType: "l1",
      url: "https://evm.cronos.org",
      chainId: 25,
      accounts: [deployerKey],
    },
  },

  chainDescriptors: {
    25: {
      name: "cronos",
      hardforkHistory: {
        cancun: { blockNumber: 0 },
      },
      blockExplorers: {
        etherscan: {
          name: "Cronoscan",
          url: "https://explorer.cronos.org",
          apiUrl: "https://explorer-api.cronos.org/mainnet/api/v1/hardhat/contract",
        },
      },
    },
    5003: {
      name: "mantle-sepolia",
      hardforkHistory: {
        cancun: { blockNumber: 0 },
      },
      blockExplorers: {
        etherscan: {
          name: "Mantle Explorer",
          url: "https://explorer.sepolia.mantle.xyz",
          apiUrl: "https://explorer.sepolia.mantle.xyz/api",
        },
      },
    },
  },

  verify: {
    etherscan: {
      apiKey: process.env.MANTLE_SEPOLIA_EXPLORER_API_KEY ?? "",
    },
  },
});

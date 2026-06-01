/**
 * Test the active router contract interaction on Mantle Sepolia.
 *
 * This script:
 * 1. Reads PRIVATE_KEY from the environment
 * 2. Verifies the wallet is already delegated to the active router via ERC-7702
 * 3. Generates a throwaway session key
 * 4. Calls grantSession(...) on the AgentDelegator contract
 * 5. Prints the transaction hash and SessionGranted event data
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx hardhat run scripts/test-agent-delegator.ts --network mantleSepolia
 */

import hre from "hardhat";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {
  createWalletClient,
  createPublicClient,
  fallback,
  http,
  encodeFunctionData,
  decodeEventLog,
  type Hex,
  type Address,
} from "viem";
import { mantleSepoliaTestnet } from "viem/chains";
import {
  agentDelegatorAbi,
  MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS,
} from "../../packages/contracts/dist/index.js";

const MANTLE_SEPOLIA_RPC_URLS = [
  "https://rpc.sepolia.mantle.xyz",
  "https://mantle-sepolia.drpc.org",
];

async function main() {
  const privateKey = process.env.PRIVATE_KEY as Hex | undefined;
  if (!privateKey) {
    console.error("Error: PRIVATE_KEY environment variable not set.");
    console.error("");
    console.error("Usage:");
    console.error("  PRIVATE_KEY=0x... npx hardhat run scripts/test-agent-delegator.ts --network mantleSepolia");
    process.exit(1);
  }

  const account = privateKeyToAccount(
    privateKey.startsWith("0x") ? privateKey : (`0x${privateKey}` as Hex)
  );

  // Use the configured Hardhat network to confirm chain identity.
  const connection = await hre.network.connect();
  const publicClientHh = await connection.viem.getPublicClient();
  const chainId = await publicClientHh.getChainId();

  console.log("Chain ID:", chainId);
  console.log("Account address:", account.address);

  if (chainId !== 5003) {
    throw new Error(`Unsupported chain ID: ${chainId}. Use Mantle Sepolia (5003).`);
  }

  const contractAddress =
    (process.env.MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS ||
      process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS ||
      MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS) as Address;
  const chain = mantleSepoliaTestnet;
  const rpcTransport = fallback(MANTLE_SEPOLIA_RPC_URLS.map((url) => http(url)));

  const publicClient = createPublicClient({
    chain,
    transport: rpcTransport,
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: rpcTransport,
  });

  const delegationCode = await publicClient.getCode({ address: account.address });
  const expectedDelegationCode = `0xef0100${contractAddress.slice(2).toLowerCase()}`;

  if (!delegationCode || delegationCode.toLowerCase() !== expectedDelegationCode.toLowerCase()) {
    console.error("");
    console.error("This wallet is not delegated to the active router yet.");
    console.error("Run the smart-account enable flow first, then run this script again.");
    console.error("Expected delegation code:", expectedDelegationCode);
    console.error("Actual code:", delegationCode ?? "0x");
    process.exit(1);
  }

  console.log("Delegation verified:", delegationCode);

  const sessionKeyPrivateKey = generatePrivateKey();
  const sessionKeyAccount = privateKeyToAccount(sessionKeyPrivateKey);

  const validAfter = Math.floor(Date.now() / 1000);
  const validUntil = validAfter + 60 * 60; // 1 hour

  const allowedTargets: Address[] = [];
  const allowedSelectors: Hex[] = [];
  const approvedContracts: Array<{
    contractAddress: Address
    nameHash: Hex
    versionHash: Hex
  }> = [];

  console.log("Generated session key:", sessionKeyAccount.address);
  console.log("Calling grantSession(...) on the active router...");

  const txHash = await walletClient.sendTransaction({
    to: account.address,
    data: encodeFunctionData({
      abi: agentDelegatorAbi,
      functionName: "grantSession",
      args: [
        sessionKeyAccount.address,
        allowedTargets,
        allowedSelectors,
        validAfter,
        validUntil,
        approvedContracts,
      ],
    }),
  });

  console.log("Transaction submitted:", txHash);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  console.log("Transaction confirmed in block:", receipt.blockNumber);
  console.log("Transaction status:", receipt.status);

  let sessionId: Hex | null = null;

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: agentDelegatorAbi,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === "SessionGranted") {
        sessionId = (decoded.args as { sessionId: Hex }).sessionId;
        break;
      }
    } catch {
      // Ignore non-matching logs
    }
  }

  console.log("Session ID:", sessionId ?? "not found");
  console.log("Session key:", sessionKeyAccount.address);
  console.log("Allowed targets:", allowedTargets);
  console.log("Allowed selectors:", allowedSelectors);
  console.log("Valid after:", validAfter);
  console.log("Valid until:", validUntil);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

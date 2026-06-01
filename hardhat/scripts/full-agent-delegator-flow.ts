/**
 * Full active-router flow on Mantle Sepolia.
 *
 * This script:
 * 1. Reads PRIVATE_KEY from the environment
 * 2. Enables ERC-7702 delegation to the active router
 * 3. Verifies delegation was applied
 * 4. Generates a throwaway session key
 * 5. Calls grantSession(...) on the active router
 * 6. Prints both transaction hashes
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx hardhat run scripts/full-agent-delegator-flow.ts --network mantleSepolia
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
    console.error("  PRIVATE_KEY=0x... npx hardhat run scripts/full-agent-delegator-flow.ts --network mantleSepolia");
    process.exit(1);
  }

  const account = privateKeyToAccount(
    privateKey.startsWith("0x") ? privateKey : (`0x${privateKey}` as Hex)
  );

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

  console.log("Active router:", contractAddress);

  const currentCodeBefore = await publicClient.getCode({ address: account.address });
  const expectedDelegationCode = `0xef0100${contractAddress.slice(2).toLowerCase()}`;

  console.log("Current account code:", currentCodeBefore ?? "0x");

  if (currentCodeBefore?.toLowerCase() !== expectedDelegationCode.toLowerCase()) {
    console.log("Enabling ERC-7702 delegation...");

    const authorization = await walletClient.signAuthorization({
      contractAddress,
      executor: "self",
    });

    console.log("Authorization signed:", {
      address: authorization.address,
      chainId: authorization.chainId,
      nonce: authorization.nonce,
    });

    const enableHash = await walletClient.sendTransaction({
      to: account.address,
      data: "0x",
      authorizationList: [authorization],
      gas: 100000n,
    });

    console.log("Enable tx hash:", enableHash);

    const enableReceipt = await publicClient.waitForTransactionReceipt({
      hash: enableHash,
      confirmations: 1,
    });

    console.log("Enable tx status:", enableReceipt.status);
    console.log("Enable tx block:", enableReceipt.blockNumber);

    const currentCodeAfter = await publicClient.getCode({ address: account.address });
    console.log("Account code after enable:", currentCodeAfter ?? "0x");

    if (currentCodeAfter?.toLowerCase() !== expectedDelegationCode.toLowerCase()) {
      throw new Error("ERC-7702 delegation was not applied correctly");
    }
  } else {
    console.log("Delegation already enabled, skipping the enable step.");
  }

  console.log("Generating session key...");
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

  console.log("Session key address:", sessionKeyAccount.address);
  console.log("Granting session...");

  const sessionTxHash = await walletClient.sendTransaction({
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

  console.log("grantSession tx hash:", sessionTxHash);

  const sessionReceipt = await publicClient.waitForTransactionReceipt({
    hash: sessionTxHash,
    confirmations: 1,
  });

  console.log("grantSession tx status:", sessionReceipt.status);
  console.log("grantSession tx block:", sessionReceipt.blockNumber);

  let sessionId: Hex | null = null;

  for (const log of sessionReceipt.logs) {
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
      // Ignore logs that are not SessionGranted
    }
  }

  console.log("Session ID:", sessionId ?? "not found");
  console.log("Enable tx hash:", currentCodeBefore?.toLowerCase() !== expectedDelegationCode.toLowerCase() ? "see above" : "skipped");
  console.log("Grant session tx hash:", sessionTxHash);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

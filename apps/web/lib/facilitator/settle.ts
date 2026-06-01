import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  fallback,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { cronos, mantleSepoliaTestnet } from 'viem/chains'
import { actionRouterAbi } from '@x402/contracts'
import type {
  PaymentHeader,
  PaymentRequirements,
  SettleResult,
  FeeConfig,
} from './types'
import { detectSignatureType } from './detect'
import { unwrapEIP6492 } from './unwrap'
import { getChainConfig, parseChainId } from './chains'
import { getDefaultFeeConfig, calculateNetAmount } from './fee'
import { paymentNonceRepository } from '@/lib/repositories'
import { getMantleSepoliaActionRouterAddress } from '@/lib/contracts'

const MANTLE_SEPOLIA_RPC_URLS = [
  'https://rpc.sepolia.mantle.xyz',
  'https://mantle-sepolia.drpc.org',
]

/**
 * Calculate the Ethermint/Cronos floor gas based on calldata size.
 * Ethermint enforces a minimum gas based on transaction data (EIP-2028):
 * - 4 gas per zero byte
 * - 16 gas per non-zero byte
 * - Plus 21000 base transaction gas
 */
function calculateFloorGas(calldata: Hex): bigint {
  const data = calldata.slice(2) // Remove '0x' prefix
  let calldataGas = BigInt(0)

  for (let i = 0; i < data.length; i += 2) {
    const byte = parseInt(data.slice(i, i + 2), 16)
    calldataGas += byte === 0 ? BigInt(4) : BigInt(16)
  }

  const baseTxGas = BigInt(21000)
  return baseTxGas + calldataGas
}

function formatSettlementError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (
    message.includes('insufficient funds') ||
    message.includes('balance 0') ||
    message.includes('insufficient balance')
  ) {
    return 'Relayer wallet has insufficient native MNT for gas on Mantle Sepolia.'
  }

  return message
}

/**
 * Get the viem chain object for a chain ID
 */
function getViemChain(chainId: number) {
  if (chainId === 25) return cronos
  if (chainId === 338) {
    throw new Error('Cronos testnet is no longer supported. Use Mantle Sepolia (5003).')
  }
  if (chainId === 5003) return mantleSepoliaTestnet
  throw new Error(`Unsupported chain: ${chainId}`)
}

/**
 * Forward settlement to the official Cronos facilitator
 */
async function settleWithOfficialFacilitator(
  facilitatorUrl: string,
  paymentHeaderBase64: string,
  paymentRequirements: PaymentRequirements
): Promise<SettleResult> {
  const settlementRequest = {
    x402Version: 1,
    paymentHeader: paymentHeaderBase64,
    paymentRequirements,
  }

  console.log('[Facilitator] Forwarding settlement to official facilitator:', facilitatorUrl)

  try {
    const response = await fetch(`${facilitatorUrl}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X402-Version': '1',
      },
      body: JSON.stringify(settlementRequest),
    })

    const responseText = await response.text()
    console.log('[Facilitator] Official facilitator settlement response:', responseText)

    if (!response.ok) {
      return {
        success: false,
        error: `Settlement failed: ${response.status} ${responseText}`,
      }
    }

    const result = JSON.parse(responseText)

    if (result.event === 'payment.settled' && result.txHash) {
      return {
        success: true,
        txHash: result.txHash,
      }
    }

    return {
      success: false,
      error: 'Unexpected facilitator response',
    }
  } catch (error) {
    console.error('[Facilitator] Official facilitator settlement failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Settlement request failed',
    }
  }
}

/**
 * Settle a smart account payment through the router contract.
 *
 * The router keeps the visible settlement on one contract page while
 * forwarding the underlying EIP-3009 transfer to the token contract.
 */
async function settleSmartAccountPayment(
  walletClient: WalletClient,
  publicClient: PublicClient,
  header: PaymentHeader,
  feeConfig: FeeConfig,
  chain: typeof cronos | typeof mantleSepoliaTestnet,
  account: Account
): Promise<SettleResult> {
  const payload = header.payload
  const routerAddress = getMantleSepoliaActionRouterAddress()

  // Unwrap EIP-6492 to get inner signature
  const innerSignature = unwrapEIP6492(payload.signature as Hex)

  // Calculate fee (for logging, we'll collect it in a future iteration)
  const amount = BigInt(payload.value)
  const { netAmount, fee } = calculateNetAmount(amount, feeConfig)

  console.log('[Facilitator] Settling smart account payment:', {
    from: payload.from,
    to: payload.to,
    amount: amount.toString(),
    fee: fee.toString(),
    netAmount: netAmount.toString(),
    innerSignatureLength: innerSignature.length,
  })

  try {
    // Execute the visible settlement through the router.
    const args = [
      payload.asset as Address,
      payload.from as Address,
      payload.to as Address,
      amount,
      BigInt(payload.validAfter),
      BigInt(payload.validBefore),
      payload.nonce as Hex,
      innerSignature,
    ] as const

    // Encode calldata to calculate Ethermint floor gas
    const calldata = encodeFunctionData({
      abi: actionRouterAbi,
      functionName: 'settlePayment',
      args,
    })

    // Calculate floor gas (Ethermint enforces minimum based on calldata size)
    const floorGas = calculateFloorGas(calldata)

    // Get EVM execution gas estimate
    const estimatedGas = await publicClient.estimateContractGas({
      address: routerAddress,
      abi: actionRouterAbi,
      functionName: 'settlePayment',
      args,
      account: account.address,
    })

    // Use the higher of floor gas or estimated gas
    const gasLimit = estimatedGas > floorGas ? estimatedGas : floorGas

    console.log('[Facilitator] Gas calculation:', {
      floorGas: floorGas.toString(),
      estimatedGas: estimatedGas.toString(),
      gasLimit: gasLimit.toString(),
    })

    const hash = await walletClient.writeContract({
      chain,
      account,
      address: routerAddress,
      abi: actionRouterAbi,
      functionName: 'settlePayment',
      args,
      gas: gasLimit,
    })

    console.log('[Facilitator] Settlement transaction submitted:', hash)

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    })

    console.log('[Facilitator] Settlement confirmed in block:', receipt.blockNumber)

    return {
      success: true,
      txHash: receipt.transactionHash,
    }
  } catch (error) {
    console.error('[Facilitator] Smart account settlement failed:', error)
    return {
      success: false,
      error: formatSettlementError(error),
    }
  }
}

/**
 * Settle a payment
 *
 * - For EOA signatures: Forward to official Cronos facilitator
 * - For smart account signatures: Execute transferWithAuthorization directly
 *
 * Should only be called AFTER target API returns success
 */
export async function settlePayment(
  paymentHeaderBase64: string,
  header: PaymentHeader,
  expectedAmount: bigint,
  expectedRecipient: Address
): Promise<SettleResult> {
  const chainId = parseChainId(header.network)
  const chainConfig = getChainConfig(chainId)

  if (!chainConfig) {
    console.error('[Facilitator] Unsupported chain for settlement:', chainId)
    return {
      success: false,
      error: `Unsupported chain for settlement: ${chainId}`,
    }
  }

  // Detect signature type
  const signatureType = detectSignatureType(header.payload.signature as Hex)

  console.log('[Facilitator] Settling payment:', {
    signatureType,
    chainId,
    from: header.payload.from,
    to: header.payload.to,
    amount: header.payload.value,
  })

  let result: SettleResult

  if (signatureType === 'eoa' && chainConfig.officialFacilitatorUrl) {
    // First verify with official facilitator
    const paymentRequirements: PaymentRequirements = {
      scheme: 'exact',
      network: chainConfig.name,
      payTo: expectedRecipient,
      asset: header.payload.asset as Address,
      maxAmountRequired: expectedAmount.toString(),
      maxTimeoutSeconds: 300,
      description: 'API access payment',
      mimeType: 'application/json',
    }

    result = await settleWithOfficialFacilitator(
      chainConfig.officialFacilitatorUrl,
      paymentHeaderBase64,
      paymentRequirements
    )
  } else {
    // Settle smart account payment directly
    const relayerKey = process.env.FACILITATOR_RELAYER_KEY

  if (!relayerKey) {
    console.error('[Facilitator] FACILITATOR_RELAYER_KEY not configured')
    return {
      success: false,
      error: 'FACILITATOR_RELAYER_KEY not configured',
    }
  }

    const chain = getViemChain(chainId)
    const account = privateKeyToAccount(relayerKey as Hex)

    const transport =
      chain.id === 5003
        ? fallback(MANTLE_SEPOLIA_RPC_URLS.map((url) => http(url)))
        : http(chainConfig.rpcUrl)

    const publicClient = createPublicClient({
      chain,
      transport,
    })

    const walletClient = createWalletClient({
      account,
      chain,
      transport,
    })

    const feeConfig = getDefaultFeeConfig()

    result = await settleSmartAccountPayment(
      walletClient,
      publicClient,
      header,
      feeConfig,
      chain,
      account
    )
  }

  if (!result.success || !result.txHash) {
    console.error('[Facilitator] Settlement failed:', result.error)
    return result
  }

  console.log('[Facilitator] Payment settled! TxHash:', result.txHash)

  return result
}

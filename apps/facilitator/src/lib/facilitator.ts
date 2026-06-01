import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  fallback,
  http,
  hashTypedData,
  recoverTypedDataAddress,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mantleSepoliaTestnet } from 'viem/chains'
import { actionRouterAbi, MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS } from '@x402/contracts'
import {
  TRANSFER_WITH_AUTHORIZATION_TYPES,
  buildMntDomain,
  parseChainId,
} from '@x402/payment'
import { detectSignatureType } from './detect.js'
import { unwrapEIP6492 } from './unwrap.js'
import type {
  PaymentHeader,
  PaymentRequirements,
  SettleResult,
  VerifyResult,
  PaymentPayload,
} from './types.js'
import { paymentNonceRepository } from './nonce.js'

const MANTLE_SEPOLIA_CHAIN_ID = 5003
const MANTLE_SEPOLIA_RPC_URLS = [
  'https://rpc.sepolia.mantle.xyz',
  'https://mantle-sepolia.drpc.org',
]

function getMantleSepoliaActionRouterAddress(): Address {
  return (
    process.env.MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS ||
    process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS ||
    MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS
  ) as Address
}

function parseJsonBase64<T>(value: string): T {
  const decoded = Buffer.from(value, 'base64').toString('utf8')
  return JSON.parse(decoded) as T
}

export function parsePaymentHeader(headerValue: string): PaymentHeader {
  try {
    return parseJsonBase64<PaymentHeader>(headerValue)
  } catch {
    throw new Error('Invalid payment header format')
  }
}

function buildEIP3009Hash(payload: PaymentPayload, chainId: number): Hex {
  const domain = buildMntDomain(payload.asset, chainId)

  return hashTypedData({
    domain,
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: payload.from,
      to: payload.to,
      value: BigInt(payload.value),
      validAfter: BigInt(payload.validAfter),
      validBefore: BigInt(payload.validBefore),
      nonce: payload.nonce,
    },
  })
}

async function verifySmartAccountSignature(
  from: Address,
  hash: Hex,
  signature: Hex
): Promise<{ isValid: boolean; reason?: string }> {
  const innerSignature = unwrapEIP6492(signature)

  try {
    const publicClient = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: fallback(MANTLE_SEPOLIA_RPC_URLS.map((url) => http(url))),
    })

    const result = await publicClient.readContract({
      address: from,
      abi: [
        {
          name: 'isValidSignature',
          type: 'function',
          stateMutability: 'view',
          inputs: [
            { name: 'hash', type: 'bytes32' },
            { name: 'signature', type: 'bytes' },
          ],
          outputs: [{ name: '', type: 'bytes4' }],
        },
      ] as const,
      functionName: 'isValidSignature',
      args: [hash, innerSignature],
    })

    const isValid = result === '0x1626ba7e'
    if (!isValid) {
      return {
        isValid: false,
        reason: `isValidSignature returned ${result}, expected 0x1626ba7e`,
      }
    }

    return { isValid: true }
  } catch (error) {
    return {
      isValid: false,
      reason: `isValidSignature call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

async function verifyEoaSignature(
  payload: PaymentPayload,
  chainId: number
): Promise<{ isValid: boolean; reason?: string }> {
  try {
    const domain = buildMntDomain(payload.asset, chainId)
    const recovered = await recoverTypedDataAddress({
      domain,
      types: TRANSFER_WITH_AUTHORIZATION_TYPES,
      primaryType: 'TransferWithAuthorization',
      message: {
        from: payload.from,
        to: payload.to,
        value: BigInt(payload.value),
        validAfter: BigInt(payload.validAfter),
        validBefore: BigInt(payload.validBefore),
        nonce: payload.nonce,
      },
      signature: payload.signature as Hex,
    })

    if (recovered.toLowerCase() !== payload.from.toLowerCase()) {
      return {
        isValid: false,
        reason: `Recovered signer ${recovered} does not match payment sender ${payload.from}`,
      }
    }

    return { isValid: true }
  } catch (error) {
    return {
      isValid: false,
      reason: `EOA signature recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

export async function verifyPayment(
  paymentHeaderBase64: string,
  expectedAmount: bigint,
  expectedRecipient: Address
): Promise<{
  address: Address
  paymentNonce: Hex
  paymentHeader: PaymentHeader
  signatureType: 'eoa' | 'smart_account'
} | null> {
  try {
    const header = parsePaymentHeader(paymentHeaderBase64)

    if (header.x402Version !== 1 || header.scheme !== 'exact') {
      return null
    }

    const paymentAmount = BigInt(header.payload.value)
    if (paymentAmount < expectedAmount) {
      return null
    }

    if (header.payload.to.toLowerCase() !== expectedRecipient.toLowerCase()) {
      return null
    }

    const paymentNonce = header.payload.nonce
    if (!paymentNonce) {
      return null
    }

    if (await paymentNonceRepository.isUsed(paymentNonce)) {
      return null
    }

    const chainId = parseChainId(header.network)
    if (chainId !== MANTLE_SEPOLIA_CHAIN_ID) {
      return null
    }

    const signatureType = detectSignatureType(header.payload.signature as Hex)
    let result: VerifyResult

    if (signatureType === 'eoa') {
      const verified = await verifyEoaSignature(header.payload, chainId)
      result = {
        isValid: verified.isValid,
        invalidReason: verified.reason,
        signatureType: 'eoa',
      }
    } else {
      const hash = buildEIP3009Hash(header.payload, chainId)
      const verified = await verifySmartAccountSignature(
        header.payload.from as Address,
        hash,
        header.payload.signature as Hex
      )

      result = {
        isValid: verified.isValid,
        invalidReason: verified.reason,
        signatureType: 'smart_account',
      }
    }

    if (!result.isValid) {
      return null
    }

    return {
      address: header.payload.from as Address,
      paymentNonce,
      paymentHeader: header,
      signatureType,
    }
  } catch {
    return null
  }
}

function formatSettlementError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()

  if (
    normalized.includes('insufficient funds') ||
    normalized.includes('balance 0') ||
    normalized.includes('insufficient balance')
  ) {
    return 'Relayer wallet has insufficient native MNT for gas on Mantle Sepolia.'
  }

  if (
    normalized.includes('web server is down') ||
    normalized.includes('failed to forward tx') ||
    normalized.includes('rpc') ||
    normalized.includes('sequencer')
  ) {
    return 'Payment failed because the Mantle Sepolia RPC endpoint was unavailable. Please try again.'
  }

  return message
}

export async function settlePayment(
  paymentHeaderBase64: string,
  header: PaymentHeader,
  expectedAmount: bigint,
  expectedRecipient: Address
): Promise<SettleResult> {
  try {
    const relayerKey = process.env.FACILITATOR_RELAYER_KEY

    if (!relayerKey) {
      console.error('[Facilitator] FACILITATOR_RELAYER_KEY not configured')
      return {
        success: false,
        error: 'FACILITATOR_RELAYER_KEY not configured',
      }
    }

    const chainId = parseChainId(header.network)
    if (chainId !== MANTLE_SEPOLIA_CHAIN_ID) {
      return {
        success: false,
        error: `Unsupported chain for settlement: ${chainId}`,
      }
    }

    const account = privateKeyToAccount(relayerKey as Hex)
    const transport = fallback(MANTLE_SEPOLIA_RPC_URLS.map((url) => http(url)))

    const publicClient = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport,
    })

    const walletClient = createWalletClient({
      account,
      chain: mantleSepoliaTestnet,
      transport,
    })

    const payload = header.payload
    const routerAddress = getMantleSepoliaActionRouterAddress()
    const innerSignature = unwrapEIP6492(payload.signature as Hex)

    const amount = BigInt(payload.value)
    if (amount < expectedAmount) {
      return {
        success: false,
        error: 'Payment amount lower than expected',
      }
    }

    if (payload.to.toLowerCase() !== expectedRecipient.toLowerCase()) {
      return {
        success: false,
        error: 'Payment recipient mismatch',
      }
    }

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

    const calldata = encodeFunctionData({
      abi: actionRouterAbi,
      functionName: 'settlePayment',
      args,
    })

    const floorGas = (() => {
      const data = calldata.slice(2)
      let calldataGas = BigInt(0)

      for (let i = 0; i < data.length; i += 2) {
        const byte = Number.parseInt(data.slice(i, i + 2), 16)
        calldataGas += byte === 0 ? BigInt(4) : BigInt(16)
      }

      return BigInt(21000) + calldataGas
    })()

    const estimatedGas = await publicClient.estimateContractGas({
      address: routerAddress,
      abi: actionRouterAbi,
      functionName: 'settlePayment',
      args,
      account: account.address,
    })

    const gasLimit = estimatedGas > floorGas ? estimatedGas : floorGas

    console.log('[Facilitator] Gas calculation:', {
      floorGas: floorGas.toString(),
      estimatedGas: estimatedGas.toString(),
      gasLimit: gasLimit.toString(),
    })

    const hash = await walletClient.writeContract({
      chain: mantleSepoliaTestnet,
      account,
      address: routerAddress,
      abi: actionRouterAbi,
      functionName: 'settlePayment',
      args,
      gas: gasLimit,
    })

    console.log('[Facilitator] Settlement transaction submitted:', hash)

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
    console.error('[Facilitator] Settlement failed:', error)
    return {
      success: false,
      error: formatSettlementError(error),
    }
  }
}

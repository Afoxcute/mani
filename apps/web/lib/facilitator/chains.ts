import type { Address } from 'viem'
import type { ChainConfig, PaymentRequirements } from './types'
import {
  CHAIN_CONFIGS as SHARED_CHAIN_CONFIGS,
  DEFAULT_CHAIN_ID,
  getNetworkFromChainId as sharedGetNetworkFromChainId,
  parseChainId as sharedParseChainId,
  getMntAddress as sharedGetMntAddress,
  isSupportedChain,
} from '@x402/payment'

/** Default chain ID (testnet) */
export const defaultChainId = DEFAULT_CHAIN_ID

/**
 * Chain configurations for the facilitator
 *
 * Uses shared package constants with facilitator-specific extensions
 */
export const chainConfigs: Record<number, ChainConfig> = {
  5003: {
    chainId: 5003,
    name: 'mantle-sepolia',
    officialFacilitatorUrl: SHARED_CHAIN_CONFIGS[5003].officialFacilitatorUrl,
    usdcAddress: SHARED_CHAIN_CONFIGS[5003].mnt.address,
    rpcUrl: SHARED_CHAIN_CONFIGS[5003].rpcUrl,
  },
}

/**
 * Get chain configuration by chain ID
 */
export function getChainConfig(chainId: number): ChainConfig | null {
  return chainConfigs[chainId] ?? null
}

/**
 * Parse network string to chain ID
 * Supports only "mantle-sepolia" format and "eip155:5003" format
 */
export function parseChainId(network: string): number {
  return sharedParseChainId(network)
}

/**
 * Get network string from chain ID
 */
export function getNetworkFromChainId(chainId: number): string {
  if (isSupportedChain(chainId)) {
    return sharedGetNetworkFromChainId(chainId)
  }
  return `eip155:${chainId}`
}

/**
 * Get MNT token address for a chain
 */
export function getMntAddress(chainId: number = defaultChainId): Address {
  return sharedGetMntAddress(chainId)
}

export const getUsdceAddress = getMntAddress

/**
 * Payment details for building requirements
 */
export interface PaymentDetails {
  amount: bigint
  asset: Address
  recipient: Address
  chainId: number
  description?: string
  mimeType?: string
  maxTimeoutSeconds?: number
}

/**
 * Build payment requirements for 402 response
 */
export function buildPaymentRequirements(details: PaymentDetails): PaymentRequirements {
  const network = getNetworkFromChainId(details.chainId)

  return {
    scheme: 'exact',
    network,
    payTo: details.recipient,
    asset: details.asset,
    maxAmountRequired: details.amount.toString(),
    maxTimeoutSeconds: details.maxTimeoutSeconds ?? 300,
    description: details.description,
    mimeType: details.mimeType,
  }
}

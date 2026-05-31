import { type Address } from 'viem'
import {
  buildTransferWithAuthorizationMessage,
  USDC_E_CONFIG,
  type SupportedChainId,
} from '@x402/payment'

/**
 * x402 Client-side Payment Utilities
 *
 * Re-exports utilities from @x402/payment and provides client-specific helpers.
 */

// Re-export from shared package
export {
  TRANSFER_WITH_AUTHORIZATION_TYPES as EIP3009_TYPES,
  generateNonce,
  parseChainId,
  getNetworkFromChainId,
  buildPaymentHeader,
  encodePaymentHeader,
  type TransferWithAuthorizationMessage as EIP3009Message,
  type PaymentPayload as PaymentPayloadClient,
  type PaymentHeader as PaymentHeaderClient,
} from '@x402/payment'

/**
 * Build EIP-712 domain for a token asset
 * Uses USDC.E domain name/version (the only supported token) with the provided asset address
 */
export function buildUsdceDomain(asset: Address, chainId: number) {
  const config = USDC_E_CONFIG[chainId as SupportedChainId]
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }
  return {
    name: config.domainName,
    version: config.domainVersion,
    chainId,
    verifyingContract: asset,
  } as const
}

/**
 * Build an EIP-3009 authorization message for signing
 * Client-side helper that uses the shared buildTransferWithAuthorizationMessage
 */
export function buildEIP3009Message(params: {
  from: Address
  to: Address
  value: bigint
  validitySeconds?: number
}): {
  from: Address
  to: Address
  value: bigint
  validAfter: bigint
  validBefore: bigint
  nonce: `0x${string}`
} {
  return buildTransferWithAuthorizationMessage(params)
}

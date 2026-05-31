/**
 * @x402/payment
 *
 * Shared payment signing utilities for the x402 protocol.
 * Works in both browser and Node.js environments.
 */

// Types
export type {
  SupportedChainId,
  NetworkId,
  TokenConfig,
  ChainConfig,
  TransferWithAuthorizationMessage,
  SessionSignatureMessage,
  PaymentPayload,
  PaymentHeader,
  SessionSignatureParams,
} from './src/types'

// Constants
export {
  MNT_CONFIG,
  USDC_E_CONFIG,
  CHAIN_CONFIGS,
  CHAIN_TO_NETWORK,
  NETWORK_TO_CHAIN,
  DEFAULT_CHAIN_ID,
  SESSION_SIGNATURE_TYPES,
  TRANSFER_WITH_AUTHORIZATION_TYPES,
  TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
} from './src/constants'

// EIP-712
export {
  buildAgentDelegatorDomain,
  buildMntDomain,
  buildUsdceDomain,
  buildTokenDomain,
  computeTransferWithAuthorizationStructHash,
} from './src/eip712/index'

// Signature utilities
export {
  generateNonce,
  SIGNATURE_LENGTHS,
  buildSessionSignature,
  parseSessionSignature,
  isValidSessionSignatureFormat,
} from './src/signature/index'

// Payment utilities
export {
  buildTransferWithAuthorizationMessage,
  type BuildMessageParams,
  buildPaymentHeader,
  encodePaymentHeader,
  decodePaymentHeader,
} from './src/payment/index'

// Chain utilities
export {
  isSupportedChain,
  getChainConfig,
  getChainConfigSafe,
  getNetworkFromChainId,
  getChainFromNetwork,
  parseChainId,
  getMntAddress,
  getMntAddressSafe,
  getUsdceAddress,
  getUsdceAddressSafe,
} from './src/chains'

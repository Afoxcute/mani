import type { Address } from 'viem'
import type { ChainConfig, SupportedChainId, NetworkId, TokenConfig } from './types'

/**
 * USDC.E token configurations by chain
 */
export const USDC_E_CONFIG: Record<SupportedChainId, TokenConfig> = {
  // Cronos Mainnet
  25: {
    address: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C' as Address,
    symbol: 'USDC.E',
    decimals: 6,
    domainName: 'Bridged USDC (Stargate)',
    domainVersion: '2',
  },
  // Cronos Testnet
  338: {
    address: '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0' as Address,
    symbol: 'USDC.E',
    decimals: 6,
    domainName: 'Bridged USDC (Stargate)',
    domainVersion: '1',
  },
  // Mantle Sepolia Testnet
  5003: {
    address: '0xAcab8129E2cE587fD203FD770ec9ECAFA2C88080' as Address,
    symbol: 'USDC.E',
    decimals: 6,
    domainName: 'Bridged USDC (Stargate)',
    domainVersion: '1',
  },
} as const

/**
 * Chain configurations
 */
export const CHAIN_CONFIGS: Record<SupportedChainId, ChainConfig> = {
  25: {
    chainId: 25,
    networkId: 'cronos-mainnet',
    usdce: USDC_E_CONFIG[25],
    rpcUrl: 'https://evm.cronos.org',
    officialFacilitatorUrl: 'https://facilitator.cronoslabs.org/v2/x402',
  },
  338: {
    chainId: 338,
    networkId: 'cronos-testnet',
    usdce: USDC_E_CONFIG[338],
    rpcUrl: 'https://evm-t3.cronos.org',
    officialFacilitatorUrl: 'https://facilitator.cronoslabs.org/v2/x402',
  },
  5003: {
    chainId: 5003,
    networkId: 'mantle-sepolia',
    usdce: USDC_E_CONFIG[5003],
    rpcUrl: 'https://rpc.sepolia.mantle.xyz',
    officialFacilitatorUrl: null,
  },
} as const

/**
 * Chain ID to network ID mapping
 */
export const CHAIN_TO_NETWORK: Record<SupportedChainId, NetworkId> = {
  25: 'cronos-mainnet',
  338: 'cronos-testnet',
  5003: 'mantle-sepolia',
} as const

/**
 * Network ID to chain ID mapping
 */
export const NETWORK_TO_CHAIN: Record<NetworkId, SupportedChainId> = {
  'cronos-mainnet': 25,
  'cronos-testnet': 338,
  'mantle-sepolia': 5003,
} as const

/**
 * Default chain ID (testnet for development)
 */
export const DEFAULT_CHAIN_ID: SupportedChainId = 5003

/**
 * EIP-712 types for SessionSignature (AgentDelegator)
 */
export const SESSION_SIGNATURE_TYPES = {
  SessionSignature: [
    { name: 'verifyingContract', type: 'address' },
    { name: 'structHash', type: 'bytes32' },
  ],
} as const

/**
 * EIP-712 types for TransferWithAuthorization (EIP-3009)
 */
export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

/**
 * Type hash for TransferWithAuthorization
 */
export const TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
  'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'

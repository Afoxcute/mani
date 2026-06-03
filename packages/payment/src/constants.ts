import type { Address } from 'viem'
import type { ChainConfig, SupportedChainId, NetworkId, TokenConfig } from './types'

/**
 * MNT token configurations by chain
 */
export const MNT_CONFIG: Record<SupportedChainId, TokenConfig> = {
  // Mantle Sepolia Testnet
  5003: {
    address: '0x19f5557E23e9914A18239990f6C70D68FDF0deD5' as Address,
    symbol: 'MNT',
    decimals: 18,
    domainName: 'Mantle Token',
    domainVersion: '1',
  },
} as const

// Backward-compatible aliases for existing imports
export const USDC_E_CONFIG = MNT_CONFIG

/**
 * Chain configurations
 */
export const CHAIN_CONFIGS: Record<SupportedChainId, ChainConfig> = {
  5003: {
    chainId: 5003,
    networkId: 'mantle-sepolia',
    mnt: MNT_CONFIG[5003],
    rpcUrl: 'https://rpc.sepolia.mantle.xyz',
    officialFacilitatorUrl: null,
  },
} as const

/**
 * Chain ID to network ID mapping
 */
export const CHAIN_TO_NETWORK: Record<SupportedChainId, NetworkId> = {
  5003: 'mantle-sepolia',
} as const

/**
 * Network ID to chain ID mapping
 */
export const NETWORK_TO_CHAIN: Record<NetworkId, SupportedChainId> = {
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

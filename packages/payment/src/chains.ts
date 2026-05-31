import type { Address } from 'viem'
import { CHAIN_CONFIGS, CHAIN_TO_NETWORK, NETWORK_TO_CHAIN, DEFAULT_CHAIN_ID, MNT_CONFIG } from './constants'
import type { ChainConfig, SupportedChainId, NetworkId } from './types'

/**
 * Check if a chain ID is supported
 */
export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return chainId in CHAIN_CONFIGS
}

/**
 * Get chain configuration
 * @throws if chain is not supported
 */
export function getChainConfig(chainId: number): ChainConfig {
  if (!isSupportedChain(chainId)) {
    throw new Error(`Unsupported chain ID: ${chainId}. Supported chains: ${Object.keys(CHAIN_CONFIGS).join(', ')}`)
  }
  return CHAIN_CONFIGS[chainId]
}

/**
 * Get chain configuration (returns null if not supported)
 */
export function getChainConfigSafe(chainId: number): ChainConfig | null {
  return isSupportedChain(chainId) ? CHAIN_CONFIGS[chainId] : null
}

/**
 * Get network ID from chain ID
 */
export function getNetworkFromChainId(chainId: number): NetworkId {
  if (!isSupportedChain(chainId)) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }
  return CHAIN_TO_NETWORK[chainId]
}

/**
 * Get chain ID from network ID
 */
export function getChainFromNetwork(network: NetworkId): SupportedChainId {
  return NETWORK_TO_CHAIN[network]
}

/**
 * Parse network string to chain ID
 * Supports: 'cronos-mainnet', 'cronos-testnet', 'mantle-sepolia', 'eip155:25', 'eip155:338', 'eip155:5003'
 */
export function parseChainId(network: string): number {
  // Handle network names
  if (network in NETWORK_TO_CHAIN) {
    return NETWORK_TO_CHAIN[network as NetworkId]
  }

  // Handle CAIP-2 format (eip155:chainId)
  const parts = network.split(':')
  if (parts.length === 2 && parts[0] === 'eip155') {
    const chainId = parseInt(parts[1], 10)
    if (!isNaN(chainId)) {
      return chainId
    }
  }

  throw new Error(`Invalid network format: ${network}`)
}

/**
 * Get MNT address for a chain
 */
export function getMntAddress(chainId: number = DEFAULT_CHAIN_ID): Address {
  if (!isSupportedChain(chainId)) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }
  return MNT_CONFIG[chainId].address
}

/**
 * Get MNT address (returns null if chain not supported)
 */
export function getMntAddressSafe(chainId: number): Address | null {
  return isSupportedChain(chainId) ? MNT_CONFIG[chainId].address : null
}

// Backward-compatible aliases
export const getUsdceAddress = getMntAddress
export const getUsdceAddressSafe = getMntAddressSafe

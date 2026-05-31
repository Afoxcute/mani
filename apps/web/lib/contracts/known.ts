import type { Address } from 'viem'
import { cronos } from '@reown/appkit/networks'
import { mantleSepoliaTestnet } from 'viem/chains'

/**
 * Known contract information for UI display and session key configuration
 */
export interface KnownContract {
  address: Address
  name: string
  description: string
  category: 'payment' | 'defi' | 'nft' | 'other'
}

/**
 * Known contracts by chain ID
 *
 * These are contracts that can be approved for session key EIP-1271 signatures.
 * When creating a session, users can select which contracts the session key
 * is allowed to sign messages for.
 */
export const KNOWN_CONTRACTS: Record<number, Record<string, KnownContract>> = {
  // Mantle Sepolia Testnet
  [mantleSepoliaTestnet.id]: {
    'usdc.e': {
      address: '0xAcab8129E2cE587fD203FD770ec9ECAFA2C88080',
      name: 'USDC.e',
      description: 'Bridged USDC for x402 payments',
      category: 'payment',
    },
  },
  // Cronos Mainnet
  [cronos.id]: {
    'usdc.e': {
      address: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C',
      name: 'USDC.e',
      description: 'Bridged USDC for x402 payments',
      category: 'payment',
    },
  },
}

/**
 * Get all known contracts for a chain
 */
export function getKnownContracts(chainId: number): KnownContract[] {
  return Object.values(KNOWN_CONTRACTS[chainId] || {})
}

/**
 * Get a specific known contract by key
 */
export function getKnownContract(chainId: number, key: string): KnownContract | undefined {
  return KNOWN_CONTRACTS[chainId]?.[key]
}

/**
 * Get known contracts by category
 */
export function getKnownContractsByCategory(
  chainId: number,
  category: KnownContract['category']
): KnownContract[] {
  return getKnownContracts(chainId).filter((c) => c.category === category)
}

/**
 * Get the default approved contracts for x402 payments
 * Returns USDC.e for the given chain
 */
export function getDefaultApprovedContracts(chainId: number): KnownContract[] {
  const usdce = getKnownContract(chainId, 'usdc.e')
  return usdce ? [usdce] : []
}

/**
 * Check if an address is a known contract
 */
export function isKnownContract(chainId: number, address: Address): boolean {
  const contracts = getKnownContracts(chainId)
  return contracts.some((c) => c.address.toLowerCase() === address.toLowerCase())
}

/**
 * Get contract name by address (for display)
 */
export function getContractName(chainId: number, address: Address): string | undefined {
  const contracts = getKnownContracts(chainId)
  const contract = contracts.find((c) => c.address.toLowerCase() === address.toLowerCase())
  return contract?.name
}

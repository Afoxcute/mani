import type { Address } from 'viem'
import { mantleSepoliaTestnet } from 'viem/chains'

/**
 * Known contract metadata for display in UI
 *
 * The contract address is the source of truth for EIP-712 domain.
 * This registry provides human-readable metadata and verification status.
 */
export interface KnownContract {
  /** Contract address (lowercase) */
  address: Address
  /** Chain ID */
  chainId: number
  /** Human-readable name */
  name: string
  /** Short description */
  description: string
  /** Logo URL (optional) */
  logoUrl?: string
  /** Verification status - set by admin */
  verified: boolean
  /** Protocol/project name */
  protocol: string
  /** Contract type for categorization */
  type: 'token' | 'nft-marketplace' | 'defi' | 'other'
  /** EIP-712 domain info (for display purposes) */
  eip712Domain?: {
    name: string
    version: string
  }
  /** Supported EIP-712 types this contract uses */
  supportedTypes?: string[]
}

/**
 * Registry of known contracts across chains
 * Key format: `${chainId}:${address.toLowerCase()}`
 */
const knownContractsRegistry: Record<string, KnownContract> = {
  // ============================================================================
  // Mantle Sepolia Testnet (5003)
  // ============================================================================

  // MNT - Testnet
  [`${mantleSepoliaTestnet.id}:0x19f5557e23e9914a18239990f6c70d68fdf0ded5`]: {
    address: '0x19f5557E23e9914A18239990f6C70D68FDF0deD5' as Address,
    chainId: mantleSepoliaTestnet.id,
    name: 'MNT',
    description: 'Mantle token',
    logoUrl: '/tokens/mnt.svg',
    verified: true,
    protocol: 'Stargate',
    type: 'token',
    eip712Domain: {
      name: 'Mantle Token',
      version: '1',
    },
    supportedTypes: ['TransferWithAuthorization', 'ReceiveWithAuthorization', 'Permit'],
  },

  // Add more known contracts here as the platform grows
}

/**
 * Get known contract metadata by address and chain
 */
export function getKnownContract(address: Address, chainId: number): KnownContract | null {
  const key = `${chainId}:${address.toLowerCase()}`
  return knownContractsRegistry[key] ?? null
}

/**
 * Check if a contract is known and verified
 */
export function isContractVerified(address: Address, chainId: number): boolean {
  const contract = getKnownContract(address, chainId)
  return contract?.verified ?? false
}

/**
 * Get all known contracts for a chain
 */
export function getKnownContractsForChain(chainId: number): KnownContract[] {
  return Object.values(knownContractsRegistry).filter(c => c.chainId === chainId)
}

/**
 * Get all verified contracts for a chain
 */
export function getVerifiedContractsForChain(chainId: number): KnownContract[] {
  return getKnownContractsForChain(chainId).filter(c => c.verified)
}

/**
 * Format contract display info
 * Returns name + address preview for unknown contracts
 */
export function formatContractDisplay(address: Address, chainId: number): {
  name: string
  description: string
  logoUrl?: string
  verified: boolean
  isKnown: boolean
} {
  const known = getKnownContract(address, chainId)

  if (known) {
    return {
      name: known.name,
      description: known.description,
      logoUrl: known.logoUrl,
      verified: known.verified,
      isKnown: true,
    }
  }

  // Unknown contract - show truncated address
  return {
    name: `${address.slice(0, 6)}...${address.slice(-4)}`,
    description: 'Unknown contract',
    verified: false,
    isKnown: false,
  }
}

/**
 * Admin function to add a contract to the registry at runtime
 * In production, this would be backed by a database
 */
export function registerContract(contract: KnownContract): void {
  const key = `${contract.chainId}:${contract.address.toLowerCase()}`
  knownContractsRegistry[key] = contract
}

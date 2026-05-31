import type { Address } from 'viem'
import { cronos } from '@reown/appkit/networks'
import { mantleSepoliaTestnet } from 'viem/chains'

/**
 * Well-known token for selection in OAuth consent flows
 */
export interface WellKnownToken {
  address: Address
  symbol: string
  name: string
  decimals: number
  logoUrl?: string
  chainId: number
}

/**
 * Well-known tokens per chain
 * These are common tokens users might want to allow for DeFi operations
 */
const WELL_KNOWN_TOKENS_BY_CHAIN: Record<number, WellKnownToken[]> = {
  // Cronos Mainnet
  [cronos.id]: [
    {
      address: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C',
      symbol: 'USDC.e',
      name: 'Bridged USDC (Stargate)',
      decimals: 6,
      chainId: cronos.id,
    },
    {
      address: '0x66e428c3f67a68878562e79A0234c1F83c208770',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      chainId: cronos.id,
    },
    {
      address: '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23',
      symbol: 'WCRO',
      name: 'Wrapped CRO',
      decimals: 18,
      chainId: cronos.id,
    },
    {
      address: '0xe44Fd7fCb2b1581822D0c862B68222998a0c299a',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      chainId: cronos.id,
    },
    {
      address: '0x062E66477Faf219F25D27dCED647BF57C3107d52',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      chainId: cronos.id,
    },
  ],
  // Mantle Sepolia Testnet
  [mantleSepoliaTestnet.id]: [
    {
      address: '0xAcab8129E2cE587fD203FD770ec9ECAFA2C88080',
      symbol: 'USDC.e',
      name: 'Bridged USDC (Stargate)',
      decimals: 6,
      chainId: mantleSepoliaTestnet.id,
    },
    // Testnet may have fewer well-known tokens
    // Add more as they become available
  ],
}

/**
 * Get well-known tokens for a specific chain
 */
export function getWellKnownTokens(chainId: number): WellKnownToken[] {
  return WELL_KNOWN_TOKENS_BY_CHAIN[chainId] ?? []
}

/**
 * Get a specific well-known token by address
 */
export function getWellKnownToken(address: Address, chainId: number): WellKnownToken | undefined {
  const tokens = getWellKnownTokens(chainId)
  return tokens.find(t => t.address.toLowerCase() === address.toLowerCase())
}

/**
 * Check if an address is a well-known token
 */
export function isWellKnownToken(address: Address, chainId: number): boolean {
  return getWellKnownToken(address, chainId) !== undefined
}

/**
 * Token info for scope configuration
 * Simplified version used when storing token selections
 */
export interface TokenSelection {
  address: Address
  name: string
  symbol?: string
}

/**
 * Convert WellKnownToken to TokenSelection
 */
export function toTokenSelection(token: WellKnownToken): TokenSelection {
  return {
    address: token.address,
    name: token.name,
    symbol: token.symbol,
  }
}

import type { Address } from 'viem'
import { mantleSepoliaTestnet } from 'viem/chains'

export interface TokenConfig {
  address: Address
  symbol: string
  decimals: number
}

export interface ChainTokens {
  mnt: TokenConfig
  native: {
    symbol: string
    decimals: number
  }
}

export const tokens: Record<number, ChainTokens> = {
  // Mantle Sepolia Testnet
  [mantleSepoliaTestnet.id]: {
    mnt: {
      address: '0x19f5557E23e9914A18239990f6C70D68FDF0deD5',
      symbol: 'MNT',
      decimals: 18,
    },
    native: {
      symbol: 'MNT',
      decimals: 18,
    },
  },
} as const

export function isChainSupported(chainId: number): boolean {
  return chainId in tokens
}

export function getTokens(chainId: number): ChainTokens {
  const chainTokens = tokens[chainId]
  if (!chainTokens) {
    throw new Error(`Unsupported chain: ${chainId}`)
  }
  return chainTokens
}

export function getMntConfig(chainId: number): TokenConfig {
  return getTokens(chainId).mnt
}

export function getMntConfigSafe(chainId: number): TokenConfig | null {
  return tokens[chainId]?.mnt ?? null
}

export function getNativeConfig(chainId: number): ChainTokens['native'] {
  return getTokens(chainId).native
}

// Default chain for the app
export const defaultChainId = mantleSepoliaTestnet.id

// Backward-compatible aliases
export const getUsdceConfig = getMntConfig
export const getUsdceConfigSafe = getMntConfigSafe

import type { Address } from 'viem'
import { cronos } from '@reown/appkit/networks'
import { mantleSepoliaTestnet } from 'viem/chains'

export interface TokenConfig {
  address: Address
  symbol: string
  decimals: number
}

export interface ChainTokens {
  usdce: TokenConfig
  native: {
    symbol: string
    decimals: number
  }
}

export const tokens: Record<number, ChainTokens> = {
  // Cronos Mainnet
  [cronos.id]: {
    usdce: {
      address: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C',
      symbol: 'USDC.E',
      decimals: 6,
    },
    native: {
      symbol: 'CRO',
      decimals: 18,
    },
  },
  // Mantle Sepolia Testnet
  [mantleSepoliaTestnet.id]: {
    usdce: {
      address: '0xAcab8129E2cE587fD203FD770ec9ECAFA2C88080',
      symbol: 'USDC.E',
      decimals: 6,
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

export function getUsdceConfig(chainId: number): TokenConfig {
  return getTokens(chainId).usdce
}

export function getUsdceConfigSafe(chainId: number): TokenConfig | null {
  return tokens[chainId]?.usdce ?? null
}

export function getNativeConfig(chainId: number): ChainTokens['native'] {
  return getTokens(chainId).native
}

// Default chain for the app
export const defaultChainId = mantleSepoliaTestnet.id

/**
 * Deployed Contract Addresses
 *
 * Source: hardhat/ignition/deployments/chain-{id}/deployed_addresses.json
 */

import type { Address } from 'viem'

/**
 * Deployed contracts on Mantle Sepolia.
 *
 * This repo is wired to a single live deployment set:
 * - AgentDelegator: account logic / session validation
 * - ActionRouter: active contract page for app interactions
 */
export const MANTLE_SEPOLIA_CHAIN_ID = 5003
export const MANTLE_SEPOLIA_AGENT_DELEGATOR_ADDRESS =
  '0x3A9AB777B438d78059D1735c3ec30e6c94Ea35a1' as Address
export const MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS =
  '0x288dA822f469B9e11818dB9fA6EC74e57230342a' as Address

export const AGENT_DELEGATOR_ADDRESS: Partial<Record<number, Address>> = {
  [MANTLE_SEPOLIA_CHAIN_ID]: MANTLE_SEPOLIA_AGENT_DELEGATOR_ADDRESS,
} as const

export const ACTION_ROUTER_ADDRESS: Partial<Record<number, Address>> = {
  [MANTLE_SEPOLIA_CHAIN_ID]: MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS,
} as const

/**
 * Get AgentDelegator address for a specific chain
 * @throws if contract is not deployed on the chain
 */
export function getAgentDelegatorAddress(chainId: number): Address {
  if (chainId !== MANTLE_SEPOLIA_CHAIN_ID) {
    throw new Error(
      `AgentDelegator is deployed only on Mantle Sepolia (${MANTLE_SEPOLIA_CHAIN_ID})`
    )
  }
  return MANTLE_SEPOLIA_AGENT_DELEGATOR_ADDRESS
}

/**
 * Get ActionRouter address for a specific chain
 * @throws if contract is not deployed on the chain
 */
export function getActionRouterAddress(chainId: number): Address {
  if (chainId !== MANTLE_SEPOLIA_CHAIN_ID) {
    throw new Error(
      `ActionRouter is deployed only on Mantle Sepolia (${MANTLE_SEPOLIA_CHAIN_ID})`
    )
  }
  return MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS
}

/**
 * Check if AgentDelegator is deployed on a chain
 */
export function isAgentDelegatorDeployed(chainId: number): boolean {
  return chainId === MANTLE_SEPOLIA_CHAIN_ID
}

/**
 * Check if ActionRouter is deployed on a chain
 */
export function isActionRouterDeployed(chainId: number): boolean {
  return chainId === MANTLE_SEPOLIA_CHAIN_ID
}

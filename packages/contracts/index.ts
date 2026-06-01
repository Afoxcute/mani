/**
 * @x402/contracts
 *
 * Shared contract ABIs and addresses for the x402 platform
 */

// ABIs
export { agentDelegatorAbi } from './abi/AgentDelegator'
export { actionRouterAbi } from './abi/ActionRouter'

// Addresses
export {
  AGENT_DELEGATOR_ADDRESS,
  ACTION_ROUTER_ADDRESS,
  MANTLE_SEPOLIA_CHAIN_ID,
  MANTLE_SEPOLIA_AGENT_DELEGATOR_ADDRESS,
  MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS,
  getAgentDelegatorAddress,
  getActionRouterAddress,
  isAgentDelegatorDeployed,
  isActionRouterDeployed,
} from './addresses'

// Types
export type { Address } from 'viem'

/**
 * Session struct from AgentDelegator contract
 */
export interface Session {
  sessionKey: `0x${string}`
  allowedTargets: readonly `0x${string}`[]
  allowedSelectors: readonly `0x${string}`[]
  validAfter: bigint
  validUntil: bigint
  active: boolean
}

/**
 * TokenLimit struct from AgentDelegator contract
 */
export interface TokenLimit {
  token: `0x${string}`
  maxPerTx: bigint
  totalBudget: bigint
}

/**
 * TokenBudget view result from getTokenBudget
 */
export interface TokenBudgetInfo {
  maxPerTx: bigint
  totalBudget: bigint
  spent: bigint
  remaining: bigint
}

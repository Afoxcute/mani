import { agentDelegatorAbi } from './AgentDelegator'

/**
 * ActionRouter ABI
 *
 * Extends AgentDelegator with a visible settlement entrypoint so explorer
 * activity lands on the router contract page.
 */
export const actionRouterAbi = [
  ...agentDelegatorAbi,
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'token', type: 'address' },
      { indexed: true, internalType: 'address', name: 'from', type: 'address' },
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' },
      { indexed: false, internalType: 'bytes32', name: 'nonce', type: 'bytes32' },
    ],
    name: 'PaymentSettled',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
      { internalType: 'uint256', name: 'validAfter', type: 'uint256' },
      { internalType: 'uint256', name: 'validBefore', type: 'uint256' },
      { internalType: 'bytes32', name: 'nonce', type: 'bytes32' },
      { internalType: 'bytes', name: 'signature', type: 'bytes' },
    ],
    name: 'settlePayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

import type { Address, Hex } from 'viem'

export type SignatureType = 'eoa' | 'smart_account'

export interface PaymentPayload {
  from: Address
  to: Address
  value: string
  validAfter: number
  validBefore: number
  nonce: Hex
  signature: Hex
  asset: Address
}

export interface PaymentHeader {
  x402Version: number
  scheme: string
  network: string
  payload: PaymentPayload
}

export interface PaymentRequirements {
  scheme: string
  network: string
  payTo: Address
  asset: Address
  maxAmountRequired: string
  maxTimeoutSeconds: number
  description?: string
  mimeType?: string
}

export interface VerifyResult {
  isValid: boolean
  invalidReason?: string
  signatureType?: SignatureType
}

export interface SettleResult {
  success: boolean
  txHash?: Hex
  error?: string
}

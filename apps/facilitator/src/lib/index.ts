export { parsePaymentHeader, verifyPayment, settlePayment } from './facilitator.js'
export { detectSignatureType, isEIP6492Wrapped, EIP6492_MAGIC_SUFFIX } from './detect.js'
export { unwrapEIP6492 } from './unwrap.js'
export type {
  SignatureType,
  PaymentPayload,
  PaymentHeader,
  PaymentRequirements,
  VerifyResult,
  SettleResult,
} from './types.js'

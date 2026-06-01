import type { Hex } from 'viem'
import type { SignatureType } from './types.js'

export const EIP6492_MAGIC_SUFFIX =
  '0x6492649264926492649264926492649264926492649264926492649264926492' as const

export function detectSignatureType(signature: Hex): SignatureType {
  const sigHex = signature.slice(2)
  const sigLength = sigHex.length / 2

  if (sigLength > 32) {
    const suffix = signature.slice(-64).toLowerCase()
    const magicSuffix = EIP6492_MAGIC_SUFFIX.slice(2).toLowerCase()

    if (suffix === magicSuffix) {
      return 'smart_account'
    }
  }

  if (sigLength === 65) {
    return 'eoa'
  }

  if (sigLength === 97 || sigLength === 149) {
    return 'smart_account'
  }

  return 'eoa'
}

export function isEIP6492Wrapped(signature: Hex): boolean {
  const sigHex = signature.slice(2)
  const sigLength = sigHex.length / 2

  if (sigLength <= 32) {
    return false
  }

  const suffix = signature.slice(-64).toLowerCase()
  const magicSuffix = EIP6492_MAGIC_SUFFIX.slice(2).toLowerCase()

  return suffix === magicSuffix
}

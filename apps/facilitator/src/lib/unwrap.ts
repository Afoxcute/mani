import { decodeAbiParameters, type Hex } from 'viem'
import { isEIP6492Wrapped } from './detect.js'

export function unwrapEIP6492(signature: Hex): Hex {
  if (!isEIP6492Wrapped(signature)) {
    return signature
  }

  const withoutSuffix = ('0x' + signature.slice(2, -64)) as Hex

  try {
    const [innerSig] = decodeAbiParameters(
      [
        { name: 'signature', type: 'bytes' },
        { name: 'factory', type: 'address' },
        { name: 'factoryCalldata', type: 'bytes' },
      ],
      withoutSuffix
    )

    return innerSig as Hex
  } catch (error) {
    console.error('[Facilitator] Failed to decode EIP-6492 signature:', error)
    return signature
  }
}

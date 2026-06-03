import { NextResponse } from 'next/server'
import { getServerPublicKeyPem } from '@/lib/crypto/encryption'

/**
 * GET /api/crypto/public-key
 * Returns the server's RSA public key for client-side encryption.
 */
export async function GET() {
  try {
    const publicKey = getServerPublicKeyPem()

    return NextResponse.json({
      publicKey,
      algorithm: 'RSA-OAEP',
      hash: 'SHA-256',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[GET /api/crypto/public-key] Error:', {
      message,
      hasServerPublicKey: Boolean(process.env.SERVER_PUBLIC_KEY),
      hasServerPrivateKey: Boolean(process.env.SERVER_PRIVATE_KEY),
      error,
    })
    return NextResponse.json(
      {
        error: 'Server encryption not configured',
        message,
        hasServerPublicKey: Boolean(process.env.SERVER_PUBLIC_KEY),
        hasServerPrivateKey: Boolean(process.env.SERVER_PRIVATE_KEY),
      },
      { status: 500 }
    )
  }
}

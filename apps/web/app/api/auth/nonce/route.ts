import { NextResponse } from "next/server"
import { generateNonce } from "@/lib/auth/nonce"

/**
 * GET /api/auth/nonce
 *
 * Generate a new nonce for SIWX authentication.
 * Nonces are single-use and expire after 5 minutes.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const nonce = await generateNonce()

    return NextResponse.json(
      { nonce },
      {
        headers: {
          // Prevent caching of nonces
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    )
  } catch (error) {
    console.error('[GET /api/auth/nonce] Error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate auth nonce',
      },
      { status: 500 }
    )
  }
}

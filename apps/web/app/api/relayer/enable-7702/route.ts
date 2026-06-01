import { NextResponse, type NextRequest } from 'next/server'
import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mantleSepoliaTestnet } from 'viem/chains'
import {
  verifyPayment,
  settlePayment,
  buildPaymentRequirements,
  getMntAddress,
} from '@/lib/facilitator'
import { getMantleSepoliaActionRouterAddress } from '@/lib/contracts'
import { paymentNonceRepository } from '@/lib/repositories'

const MANTLE_SEPOLIA_RPC_URLS = [
  'https://rpc.sepolia.mantle.xyz',
  'https://mantle-sepolia.drpc.org',
]

// Cost to generate a wallet: 0.5 MNT (18 decimals)
const WALLET_GENERATION_COST = BigInt('500000000000000000')

/**
 * Relay an EIP-7702 enablement transaction.
 *
 * This endpoint allows clients to enable EIP-7702 smart account delegation
 * without needing a wallet that supports authorizationList transactions.
 *
 * REQUIRES x402 PAYMENT: $0.50 to prevent relayer abuse.
 *
 * The client signs the EIP-7702 authorization locally with their new wallet,
 * and this relayer submits the transaction on their behalf.
 *
 * Request body:
 * - targetAddress: The address being delegated (the new wallet)
 * - authorization: The signed EIP-7702 authorization object containing:
 *   - address: The contract address to delegate to (ActionRouter / AgentDelegator fallback)
 *   - chainId: The chain ID
 *   - nonce: The authorization nonce
 *   - r, s, yParity: The signature components
 * - chainId: The chain ID (338 for testnet, 25 for mainnet)
 */
export async function POST(request: NextRequest) {
  try {
    // Get relayer key - we'll derive the address from it for payment recipient
    const relayerKey = process.env.FACILITATOR_RELAYER_KEY
    if (!relayerKey) {
      console.error('[Enable7702] FACILITATOR_RELAYER_KEY not configured')
      return NextResponse.json(
        { error: 'Relayer not configured' },
        { status: 500 }
      )
    }

    // Derive relayer address from key - payments go to the relayer
    const relayerAccount = privateKeyToAccount(relayerKey as Hex)
    const paymentRecipient = relayerAccount.address

    // Check for x402 payment header
    const paymentHeaderValue = request.headers.get('X-PAYMENT')
    const paymentChainId = parseInt(process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_CHAIN_ID || '5003', 10)

    // If no payment, return 402 Payment Required
    if (!paymentHeaderValue) {
      const paymentRequirements = buildPaymentRequirements({
        amount: WALLET_GENERATION_COST,
        asset: getMntAddress(paymentChainId),
        recipient: paymentRecipient as Address,
        chainId: paymentChainId,
        description: 'Smart account wallet generation fee',
        mimeType: 'application/json',
        maxTimeoutSeconds: 300,
      })

      console.log('[Enable7702] No payment - returning 402 with requirements')

      return NextResponse.json(
        { paymentRequirements },
        { status: 402 }
      )
    }

    // Verify payment signature
    console.log('[Enable7702] Verifying payment signature...')
    const paymentResult = await verifyPayment(
      paymentHeaderValue,
      WALLET_GENERATION_COST,
      paymentRecipient as Address
    )

    if (!paymentResult) {
      console.log('[Enable7702] Payment verification failed')
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 402 }
      )
    }

    console.log('[Enable7702] Payment verified for wallet:', paymentResult.address)

    // Parse the request body
    const body = await request.json()

    const { targetAddress, authorization, chainId: bodyChainId } = body

    // Validate required fields
    if (!targetAddress || !authorization) {
      return NextResponse.json(
        { error: 'Missing required fields: targetAddress, authorization' },
        { status: 400 }
      )
    }

    // Validate authorization object
    if (
      !authorization.address ||
      authorization.chainId === undefined ||
      authorization.nonce === undefined ||
      !authorization.r ||
      !authorization.s ||
      authorization.yParity === undefined
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid authorization object. Required: address, chainId, nonce, r, s, yParity',
        },
        { status: 400 }
      )
    }

    console.log('[Enable7702] Received request:', {
      targetAddress,
      authorizationAddress: authorization.address,
      chainId: bodyChainId,
    })

    // Determine chain from body or default to Mantle Sepolia for safety
    const chainId = bodyChainId || 5003

    if (chainId !== 5003) {
      return NextResponse.json(
        { error: `Unsupported chain ID: ${chainId}. Use Mantle Sepolia (5003).` },
        { status: 400 }
      )
    }

    // Verify the authorization is for the correct router contract
    const expectedContract = getMantleSepoliaActionRouterAddress()
    if (
      authorization.address.toLowerCase() !== expectedContract.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error: `Authorization is for wrong contract. Expected ${expectedContract}, got ${authorization.address}`,
        },
        { status: 400 }
      )
    }

    const chain = mantleSepoliaTestnet
    const rpcTransport = fallback(MANTLE_SEPOLIA_RPC_URLS.map((url) => http(url)))

    console.log('[Enable7702] Using chain:', { chainId, rpcUrls: MANTLE_SEPOLIA_RPC_URLS })

    // Create clients
    const publicClient = createPublicClient({
      chain,
      transport: rpcTransport,
    })

    const walletClient = createWalletClient({
      account: relayerAccount,
      chain,
      transport: rpcTransport,
    })

    // Check if target already has delegation
    const existingCode = await publicClient.getCode({
      address: targetAddress as Address,
    })
    const expectedCode = `0xef0100${expectedContract.slice(2).toLowerCase()}`

    if (existingCode?.toLowerCase() === expectedCode.toLowerCase()) {
      console.log('[Enable7702] Target already has correct delegation - NOT charging')
      // Don't charge if already enabled - no work was done
      return NextResponse.json({
        success: true,
        alreadyEnabled: true,
        message: 'Smart account already enabled',
      })
    }

    // Settle the x402 payment FIRST (charge the user before doing work)
    // This ensures the user has sufficient balance before we submit the 7702 transaction
    console.log('[Enable7702] Settling payment first...')
    const settlement = await settlePayment(
      paymentHeaderValue,
      paymentResult.paymentHeader,
      WALLET_GENERATION_COST,
      paymentRecipient as Address
    )

    if (!settlement.success || !settlement.txHash) {
      const settlementError = settlement.error ?? 'Payment settlement failed'
      console.error(
        `[Enable7702] Payment settlement failed: ${settlementError} - aborting 7702 enablement`
      )

      const isRelayerFundingIssue =
        settlementError.includes('Relayer wallet has insufficient native MNT') ||
        settlementError.includes('insufficient funds')

      return NextResponse.json(
        {
          error: isRelayerFundingIssue
            ? 'Payment failed because the relayer wallet has insufficient native MNT for gas on Mantle Sepolia. Please fund the relayer wallet and try again.'
            : 'Payment failed because settlement could not be completed. Please try again.',
        },
        { status: 402 }
      )
    }

    console.log('[Enable7702] Payment settled! TxHash:', settlement.txHash)
    // Mark nonce as used after successful settlement
    await paymentNonceRepository.consume(paymentResult.paymentNonce)

    console.log('[Enable7702] Submitting 7702 transaction for:', targetAddress)

    // Format the authorization for the transaction
    const formattedAuth = {
      address: authorization.address as Address,
      chainId: authorization.chainId,
      nonce: authorization.nonce,
      r: authorization.r as Hex,
      s: authorization.s as Hex,
      yParity: authorization.yParity,
    }

    // Send the transaction with the authorization list
    // The transaction is to the target address with empty data
    // The authorization list is what actually sets the delegation
    const hash = await walletClient.sendTransaction({
      to: targetAddress as Address,
      data: '0x',
      authorizationList: [formattedAuth],
      gas: BigInt(100000), // EIP-7702 requires extra gas for the authorization list
    })

    console.log('[Enable7702] Transaction submitted:', hash)

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    })

    console.log('[Enable7702] Transaction confirmed in block:', receipt.blockNumber)

    if (receipt.status === 'reverted') {
      // Payment was already taken but 7702 failed - this is a problem
      // In production, we might want to refund or retry
      console.error('[Enable7702] Transaction reverted after payment was taken!')
      return NextResponse.json(
        { error: 'Transaction reverted. Please contact support for a refund.' },
        { status: 500 }
      )
    }

    // Verify the delegation was applied
    const newCode = await publicClient.getCode({
      address: targetAddress as Address,
    })

    if (newCode?.toLowerCase() !== expectedCode.toLowerCase()) {
      console.error('[Enable7702] Delegation verification failed:', {
        expected: expectedCode,
        actual: newCode,
      })
      return NextResponse.json(
        {
          error:
            'Delegation was not applied. The transaction succeeded but the account code was not updated. Please contact support.',
        },
        { status: 500 }
      )
    }

    console.log('[Enable7702] Delegation verified successfully')

    return NextResponse.json({
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
    })
  } catch (error) {
    console.error('[Enable7702] Error:', error)

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { error: `Failed to enable 7702: ${errorMessage}` },
      { status: 500 }
    )
  }
}

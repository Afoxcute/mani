import cors from 'cors'
import express, { type Application, type Request, type Response } from 'express'
import type { Address } from 'viem'
import { getMntAddress } from '@x402/payment'
import {
  parsePaymentHeader,
  verifyPayment,
  settlePayment,
} from './lib/facilitator.js'
import { paymentNonceRepository } from './lib/nonce.js'

type VerifyBody = {
  x402Version?: number
  paymentHeader?: string
  paymentRequirements?: {
    scheme: string
    network: string
    payTo: Address
    asset: Address
    maxAmountRequired: string
    maxTimeoutSeconds: number
    description?: string
    mimeType?: string
  }
}

type SettleBody = VerifyBody

function jsonError(res: Response, status: number, error: string) {
  return res.status(status).json({ error })
}

function extractExpectedValues(paymentRequirements: NonNullable<VerifyBody['paymentRequirements']>) {
  return {
    expectedAmount: BigInt(paymentRequirements.maxAmountRequired),
    expectedRecipient: paymentRequirements.payTo,
  }
}

export function createApp(): Application {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors())
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'facilitator',
      chainId: 5003,
      paymentAsset: getMntAddress(5003),
    })
  })

  const verifyHandler = async (req: Request, res: Response) => {
    try {
      const body = req.body as VerifyBody
      const { x402Version, paymentHeader: paymentHeaderBase64, paymentRequirements } = body

      if (x402Version !== 1) {
        return jsonError(res, 400, 'Unsupported x402 version')
      }

      if (!paymentHeaderBase64 || !paymentRequirements) {
        return jsonError(res, 400, 'Missing paymentHeader or paymentRequirements')
      }

      const header = parsePaymentHeader(paymentHeaderBase64)
      const { expectedAmount, expectedRecipient } = extractExpectedValues(paymentRequirements)

      const result = await verifyPayment(
        paymentHeaderBase64,
        expectedAmount,
        expectedRecipient
      )

      if (!result) {
        return res.json({
          isValid: false,
          invalidReason: 'Payment verification failed',
        })
      }

      return res.json({
        isValid: true,
        signatureType: result.signatureType,
        network: header.network,
      })
    } catch (error) {
      console.error('[Facilitator] Verify error:', error)
      return res.status(500).json({
        isValid: false,
        invalidReason: error instanceof Error ? error.message : 'Internal server error',
      })
    }
  }

  const settleHandler = async (req: Request, res: Response) => {
    try {
      const body = req.body as SettleBody
      const { x402Version, paymentHeader: paymentHeaderBase64, paymentRequirements } = body

      if (x402Version !== 1) {
        return jsonError(res, 400, 'Unsupported x402 version')
      }

      if (!paymentHeaderBase64 || !paymentRequirements) {
        return jsonError(res, 400, 'Missing paymentHeader or paymentRequirements')
      }

      const header = parsePaymentHeader(paymentHeaderBase64)
      const { expectedAmount, expectedRecipient } = extractExpectedValues(paymentRequirements)

      const verifyResult = await verifyPayment(
        paymentHeaderBase64,
        expectedAmount,
        expectedRecipient
      )

      if (!verifyResult) {
        return res.status(402).json({ error: 'Payment verification failed' })
      }

      const settleResult = await settlePayment(
        paymentHeaderBase64,
        header,
        expectedAmount,
        expectedRecipient
      )

      if (!settleResult.success || !settleResult.txHash) {
        return res.status(500).json({ error: settleResult.error || 'Payment settlement failed' })
      }

      await paymentNonceRepository.consume(verifyResult.paymentNonce)

      return res.json({
        event: 'payment.settled',
        txHash: settleResult.txHash,
        signatureType: verifyResult.signatureType,
      })
    } catch (error) {
      console.error('[Facilitator] Settle error:', error)
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
      })
    }
  }

  app.post('/verify', verifyHandler)
  app.post('/settle', settleHandler)
  app.post('/api/facilitator/verify', verifyHandler)
  app.post('/api/facilitator/settle', settleHandler)

  app.get('/', (_req, res) => {
    res.json({
      service: 'facilitator',
      routes: {
        verify: '/api/facilitator/verify',
        settle: '/api/facilitator/settle',
        health: '/health',
      },
    })
  })

  return app
}

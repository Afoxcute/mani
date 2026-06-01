import dotenv from 'dotenv'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const appRoot = resolve(__dirname, '..')

dotenv.config({ path: resolve(appRoot, '.env.local') })
dotenv.config({ path: resolve(appRoot, '.env') })

async function main() {
  const { createApp } = await import('./server.js')

  const PORT = parseInt(process.env.PORT ?? '3002', 10)

  console.log('[Facilitator] Starting...')
  console.log(`[Facilitator] Port: ${PORT}`)
  console.log(`[Facilitator] Redis configured: ${!!process.env.REDIS_URL}`)
  console.log(`[Facilitator] Relayer key configured: ${!!process.env.FACILITATOR_RELAYER_KEY}`)

  const app = createApp()

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Facilitator] Running at http://0.0.0.0:${PORT}`)
    console.log(`[Facilitator] Verify endpoint: http://0.0.0.0:${PORT}/api/facilitator/verify`)
    console.log(`[Facilitator] Settle endpoint: http://0.0.0.0:${PORT}/api/facilitator/settle`)
  })

  const shutdown = () => {
    console.log('[Facilitator] Shutting down...')
    server.close(() => process.exit(0))
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((error) => {
  console.error('[Facilitator] Fatal error:', error)
  process.exit(1)
})

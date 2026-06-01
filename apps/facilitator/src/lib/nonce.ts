import { randomUUID } from 'crypto'
import Redis from 'ioredis'

export type NonceState = 'pending' | 'used'

type MemoryNonceRecord = {
  state: NonceState
  expiresAt: number
}

const memoryNonceStore = new Map<string, MemoryNonceRecord>()
let redisFallbackWarned = false

function warnRedisFallback(action: string, error: unknown): void {
  if (redisFallbackWarned) {
    return
  }

  redisFallbackWarned = true

  console.warn(
    `[NonceRepository] Redis unavailable, falling back to in-memory nonces for ${action}.`,
    error instanceof Error ? error.message : error
  )
}

function purgeExpiredNonce(key: string): MemoryNonceRecord | null {
  const entry = memoryNonceStore.get(key)
  if (!entry) {
    return null
  }

  if (Date.now() > entry.expiresAt) {
    memoryNonceStore.delete(key)
    return null
  }

  return entry
}

class RedisClientManager {
  private static instance: Redis | null = null

  static getClient(): Redis {
    if (!this.instance) {
      this.instance = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) return null
          return Math.min(times * 100, 3000)
        },
      })

      this.instance.on('error', (err) => {
        console.error('[Redis] Connection error:', err.message)
      })
    }

    return this.instance
  }
}

export class NonceRepository {
  constructor(
    private readonly keyPrefix: string,
    private readonly ttlSeconds: number
  ) {}

  private get redis(): Redis {
    return RedisClientManager.getClient()
  }

  private buildKey(id: string): string {
    return `${this.keyPrefix}${id}`
  }

  async generate(): Promise<string> {
    const nonce = randomUUID()
    const key = this.buildKey(nonce)

    try {
      await this.redis.set(key, 'pending', 'EX', this.ttlSeconds)
    } catch (error) {
      warnRedisFallback('generate', error)
      memoryNonceStore.set(key, {
        state: 'pending',
        expiresAt: Date.now() + this.ttlSeconds * 1000,
      })
    }

    return nonce
  }

  async consume(nonce: string): Promise<boolean> {
    const key = this.buildKey(nonce)

    try {
      const script = `
        local value = redis.call('GET', KEYS[1])
        if value == 'pending' then
          redis.call('SET', KEYS[1], 'used', 'KEEPTTL')
          return 1
        end
        return 0
      `

      const result = await this.redis.eval(script, 1, key)
      return result === 1
    } catch (error) {
      warnRedisFallback('consume', error)
      const entry = purgeExpiredNonce(key)
      if (!entry || entry.state !== 'pending') {
        return false
      }

      entry.state = 'used'
      memoryNonceStore.set(key, entry)
      return true
    }
  }

  async isUsed(nonce: string): Promise<boolean> {
    const key = this.buildKey(nonce)

    try {
      const value = await this.redis.get(key)
      return value === 'used'
    } catch (error) {
      warnRedisFallback('isUsed', error)
      const entry = purgeExpiredNonce(key)
      return entry?.state === 'used'
    }
  }
}

export const paymentNonceRepository = new NonceRepository('x402:nonce:', 60 * 60)

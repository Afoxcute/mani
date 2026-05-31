import { randomUUID } from 'crypto'
import { BaseRepository } from './base'

/**
 * Nonce states for tracking usage.
 */
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

/**
 * Generic nonce repository for managing single-use tokens.
 *
 * Used for SIWX authentication and x402 payment verification
 * to prevent replay attacks.
 */
export class NonceRepository extends BaseRepository {
  private readonly ttlSeconds: number

  constructor(keyPrefix: string, ttlSeconds: number) {
    super(keyPrefix)
    this.ttlSeconds = ttlSeconds
  }

  /**
   * Generate a new nonce with the configured TTL.
   */
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

  /**
   * Verify and consume a nonce atomically.
   * Returns true if the nonce was valid and unused.
   *
   * This is atomic - the nonce is marked as used in the same operation.
   */
  async consume(nonce: string): Promise<boolean> {
    const key = this.buildKey(nonce)

    try {
      // Lua script for atomic get-and-set
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

  /**
   * Check if a nonce exists and is still valid (without consuming it).
   */
  async isValid(nonce: string): Promise<boolean> {
    const key = this.buildKey(nonce)
    try {
      const value = await this.redis.get(key)
      return value === 'pending'
    } catch (error) {
      warnRedisFallback('isValid', error)
      const entry = purgeExpiredNonce(key)
      return entry?.state === 'pending'
    }
  }

  /**
   * Check if a nonce has already been used.
   */
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

  /**
   * Get the current state of a nonce.
   */
  async getState(nonce: string): Promise<NonceState | null> {
    const key = this.buildKey(nonce)
    try {
      const value = await this.redis.get(key)
      return value as NonceState | null
    } catch (error) {
      warnRedisFallback('getState', error)
      const entry = purgeExpiredNonce(key)
      return entry?.state ?? null
    }
  }

  /**
   * Manually invalidate a nonce (e.g., on logout).
   */
  async invalidate(nonce: string): Promise<boolean> {
    const key = this.buildKey(nonce)
    try {
      const deleted = await this.redis.del(key)
      return deleted > 0
    } catch (error) {
      warnRedisFallback('invalidate', error)
      return memoryNonceStore.delete(key)
    }
  }

  /**
   * Count active (pending) nonces - useful for monitoring.
   * Note: Uses SCAN which may be slow on large datasets.
   */
  async countActive(): Promise<number> {
    try {
      let count = 0
      let cursor = '0'

      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${this.keyPrefix}*`,
          'COUNT',
          100
        )
        cursor = nextCursor

        // Check each key's value
        for (const key of keys) {
          const value = await this.redis.get(key)
          if (value === 'pending') count++
        }
      } while (cursor !== '0')

      return count
    } catch (error) {
      warnRedisFallback('countActive', error)

      let count = 0
      for (const [key, entry] of memoryNonceStore.entries()) {
        if (!key.startsWith(this.keyPrefix)) {
          continue
        }

        if (!purgeExpiredNonce(key)) {
          continue
        }

        if (entry.state === 'pending') {
          count++
        }
      }

      return count
    }
  }
}

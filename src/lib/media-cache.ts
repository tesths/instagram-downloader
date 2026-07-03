import { Redis } from '@upstash/redis'
import { ResourceInfo } from '@/types'

const MEDIA_CACHE_PREFIX = 'ig-media'
const DEFAULT_MEDIA_CACHE_TTL_SECONDS = 60 * 30

type CachedMediaResource = {
  filename: string
  sourceUrl: string
  type: ResourceInfo['type']
}

let redisClient: Redis | null | undefined

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  redisClient = url && token
    ? new Redis({ url, token })
    : null

  return redisClient
}

function getCacheTtlSeconds(): number {
  const ttl = Number(process.env.MEDIA_CACHE_TTL_SECONDS)
  return Number.isSafeInteger(ttl) && ttl > 0
    ? ttl
    : DEFAULT_MEDIA_CACHE_TTL_SECONDS
}

function toCacheKey(id: string): string {
  return `${MEDIA_CACHE_PREFIX}:${id}`
}

export function createMediaCacheId(): string {
  return crypto.randomUUID()
}

export async function cacheMediaResource(
  id: string,
  resource: ResourceInfo
): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return false

  const cachedResource: CachedMediaResource = {
    filename: resource.filename,
    sourceUrl: resource.url,
    type: resource.type
  }

  try {
    await redis.set(toCacheKey(id), cachedResource, {
      ex: getCacheTtlSeconds()
    })

    return true
  } catch {
    return false
  }
}

export async function getCachedMediaResource(
  id: string | null
): Promise<CachedMediaResource | null> {
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return null

  const redis = getRedis()
  if (!redis) return null

  try {
    return await redis.get<CachedMediaResource>(toCacheKey(id))
  } catch {
    return null
  }
}

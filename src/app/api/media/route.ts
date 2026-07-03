import { NextRequest, NextResponse } from 'next/server'
import Ig from '@/core/Ig'
import { isValidIgUrl } from '@/lib/utils'
import { POST_URL_PARAMS } from '@/lib/constant'
import { ResourceInfo } from '@/types'
import { getCachedMediaResource } from '@/lib/media-cache'

const MEDIA_URL_PARAMS = 'url'
const FILENAME_PARAMS = 'filename'
const ID_PARAMS = 'id'
const INDEX_PARAMS = 'index'
const DOWNLOAD_TIMEOUT_MS = 30000
const IG_API_TIMEOUT_MS = 18000
const ALLOWED_MEDIA_HOSTS = [
  'cdninstagram.com',
  'fbcdn.net'
]

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Instagram request timed out. Please try again.'))
      }, timeoutMs)
    })
  ])
}

function isAllowedMediaUrl(value: string | null): value is string {
  if (!value) return false

  try {
    const parsedUrl = new URL(value)
    return (
      parsedUrl.protocol === 'https:' &&
      ALLOWED_MEDIA_HOSTS.some((host) => (
        parsedUrl.hostname === host ||
        parsedUrl.hostname.endsWith(`.${host}`)
      ))
    )
  } catch {
    return false
  }
}

function sanitizeFilename(value: string | null): string {
  if (!value) return 'instagram-media'

  return value
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 180) || 'instagram-media'
}

function parseMediaIndex(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null

  const index = Number(value)
  return Number.isSafeInteger(index) ? index : null
}

async function resolveMediaResource(req: NextRequest): Promise<ResourceInfo | null> {
  const postUrl = req.nextUrl.searchParams.get(POST_URL_PARAMS)
  const index = parseMediaIndex(req.nextUrl.searchParams.get(INDEX_PARAMS))

  if (!isValidIgUrl(postUrl) || index === null) {
    return null
  }

  const resources = await withTimeout(
    new Ig(postUrl as string).getData(),
    IG_API_TIMEOUT_MS
  )

  return resources[index] ?? null
}

function shouldRefreshMediaUrl(status: number): boolean {
  return status === 401 || status === 403 || status === 404 || status === 410
}

async function fetchMedia(
  req: NextRequest,
  mediaUrl: string,
  signal: AbortSignal
): Promise<Response> {
  return fetch(mediaUrl, {
    headers: buildDownloadHeaders(req),
    signal
  })
}

function buildDownloadHeaders(req: NextRequest): Headers {
  const headers = new Headers({
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: '*/*',
    Referer: 'https://www.instagram.com/',
    Origin: 'https://www.instagram.com/'
  })
  const range = req.headers.get('range')

  if (range) {
    headers.set('Range', range)
  }

  return headers
}

function toResponseHeaders(
  upstreamHeaders: Headers,
  filename: string
): Headers {
  const headers = new Headers()
  const passthroughHeaders = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'etag',
    'last-modified'
  ]

  passthroughHeaders.forEach((header) => {
    const value = upstreamHeaders.get(header)
    if (value) headers.set(header, value)
  })

  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/octet-stream')
  }

  headers.set('Cache-Control', 'no-store, max-age=0')
  headers.set(
    'Content-Disposition',
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  )

  return headers
}

export async function GET(req: NextRequest) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

  try {
    const initialMediaUrl = req.nextUrl.searchParams.get(MEDIA_URL_PARAMS)
    let mediaUrl = initialMediaUrl
    let filename = sanitizeFilename(req.nextUrl.searchParams.get(FILENAME_PARAMS))
    let resource: ResourceInfo | null = null
    const cachedResource = await getCachedMediaResource(
      req.nextUrl.searchParams.get(ID_PARAMS)
    )

    if (cachedResource) {
      mediaUrl = cachedResource.sourceUrl
      filename = sanitizeFilename(cachedResource.filename)
    }

    if (!isAllowedMediaUrl(mediaUrl)) {
      resource = await resolveMediaResource(req)
      mediaUrl = resource?.url ?? null

      if (!isAllowedMediaUrl(mediaUrl)) {
        return NextResponse.json(
          { message: 'Not a valid Instagram media URL.' },
          { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
        )
      }
    }

    if (resource?.filename) {
      filename = sanitizeFilename(resource.filename)
    }

    let upstream = await fetchMedia(req, mediaUrl, controller.signal)

    if (
      shouldRefreshMediaUrl(upstream.status) &&
      req.nextUrl.searchParams.has(POST_URL_PARAMS) &&
      req.nextUrl.searchParams.has(INDEX_PARAMS)
    ) {
      await upstream.body?.cancel()
      resource = await resolveMediaResource(req)

      if (resource?.url && resource.url !== mediaUrl && isAllowedMediaUrl(resource.url)) {
        mediaUrl = resource.url
        upstream = await fetchMedia(req, mediaUrl, controller.signal)
      }
    }

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { message: `Media download failed with status ${upstream.status}.` },
        { status: upstream.status, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: toResponseHeaders(upstream.headers, filename)
    })
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Media download timed out. Please try again.'
        : 'Media download failed.'

    return NextResponse.json(
      { message },
      { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } finally {
    clearTimeout(timeout)
  }
}

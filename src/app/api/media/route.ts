import { NextRequest, NextResponse } from 'next/server'

const MEDIA_URL_PARAMS = 'url'
const FILENAME_PARAMS = 'filename'
const DOWNLOAD_TIMEOUT_MS = 30000
const ALLOWED_MEDIA_HOSTS = [
  'cdninstagram.com',
  'fbcdn.net'
]

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
  const mediaUrl = req.nextUrl.searchParams.get(MEDIA_URL_PARAMS)

  if (!isAllowedMediaUrl(mediaUrl)) {
    return NextResponse.json(
      { message: 'Not a valid Instagram media URL.' },
      { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }

  const filename = sanitizeFilename(req.nextUrl.searchParams.get(FILENAME_PARAMS))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

  try {
    const upstream = await fetch(mediaUrl, {
      headers: buildDownloadHeaders(req),
      signal: controller.signal
    })

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

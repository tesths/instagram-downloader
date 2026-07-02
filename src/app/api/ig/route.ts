import { NextRequest, NextResponse } from 'next/server'
import Ig from '@/core/Ig'
import { AxiosError } from 'axios'
import { isValidIgUrl } from '@/lib/utils'
import { POST_URL_PARAMS } from '@/lib/constant'
import { ResourceInfo } from '@/types'

const IG_API_TIMEOUT_MS = 18000
const MEDIA_URL_PARAMS = 'url'
const FILENAME_PARAMS = 'filename'
const INDEX_PARAMS = 'index'

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

function toDownloadableResources(
  resources: ResourceInfo[],
  origin: string,
  postUrl: string
): ResourceInfo[] {
  return resources.map((resource, index) => {
    const mediaUrl = new URL('/api/media', origin)
    mediaUrl.searchParams.set(MEDIA_URL_PARAMS, resource.url)
    mediaUrl.searchParams.set(POST_URL_PARAMS, postUrl)
    mediaUrl.searchParams.set(INDEX_PARAMS, String(index))
    mediaUrl.searchParams.set(FILENAME_PARAMS, resource.filename)

    return {
      ...resource,
      directUrl: resource.url,
      sourceUrl: resource.url,
      proxyUrl: mediaUrl.toString(),
      expiresAt: getInstagramCdnExpiry(resource.url),
      url: mediaUrl.toString()
    }
  })
}

function getInstagramCdnExpiry(value: string): string | undefined {
  try {
    const expiry = new URL(value).searchParams.get('oe')
    if (!expiry || !/^[a-f0-9]+$/i.test(expiry)) return undefined

    const timestamp = Number.parseInt(expiry, 16)
    if (!Number.isSafeInteger(timestamp) || timestamp <= 0) return undefined

    return new Date(timestamp * 1000).toISOString()
  } catch {
    return undefined
  }
}

export async function GET(req: NextRequest) {
  const jsonHeaders = {
    'Cache-Control': 'no-store, max-age=0'
  }
  const postUrl = req.nextUrl.searchParams.get(POST_URL_PARAMS)
  if (!isValidIgUrl(postUrl)) {
    return NextResponse.json(
      {
        message: 'Not a valid Instagram share link.'
      },
      { status: 400, headers: jsonHeaders }
    )
  }
  const validPostUrl = postUrl as string
  try {
    const ig = new Ig(validPostUrl)
    const info = await withTimeout(ig.getData(), IG_API_TIMEOUT_MS)
    const downloadableInfo = toDownloadableResources(
      info,
      req.nextUrl.origin,
      validPostUrl
    )
    return NextResponse.json(
      {
        data: downloadableInfo
      },
      { status: 200, headers: jsonHeaders }
    )
  } catch (e) {
    return NextResponse.json(
      {
        message: (e as AxiosError).message
      },
      { status: 500, headers: jsonHeaders }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import Ig from '@/core/Ig'
import { AxiosError } from 'axios'
import { isValidIgUrl } from '@/lib/utils'
import { POST_URL_PARAMS } from '@/lib/constant'
import { ResourceInfo } from '@/types'

const IG_API_TIMEOUT_MS = 18000
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
    mediaUrl.searchParams.set(POST_URL_PARAMS, postUrl)
    mediaUrl.searchParams.set(INDEX_PARAMS, String(index))
    mediaUrl.searchParams.set(FILENAME_PARAMS, resource.filename)

    return {
      ...resource,
      sourceUrl: resource.url,
      url: mediaUrl.toString()
    }
  })
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

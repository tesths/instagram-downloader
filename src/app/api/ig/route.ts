import { NextRequest, NextResponse } from 'next/server'
import Ig from '@/core/Ig'
import { AxiosError } from 'axios'
import { isValidIgUrl } from '@/lib/utils'
import { POST_URL_PARAMS } from '@/lib/constant'

const IG_API_TIMEOUT_MS = 18000

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
  try {
    const ig = new Ig(postUrl as string)
    const info = await withTimeout(ig.getData(), IG_API_TIMEOUT_MS)
    return NextResponse.json(
      {
        data: info
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

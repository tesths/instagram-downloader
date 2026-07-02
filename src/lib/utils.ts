import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Change cors limit resource to none cors resource
 * @param url
 */
export function toCorsUrl(url: string): string {
  const p = url.split('/')
  let t = ''
  for (let i = 0; i < p.length; i++) {
    if (i == 2) {
      t +=
        p[i].replaceAll('-', '--').replaceAll('.', '-') +
        atob('LnRyYW5zbGF0ZS5nb29n') +
        '/'
    } else {
      if (i != p.length - 1) {
        t += p[i] + '/'
      } else {
        t += p[i]
      }
    }
  }
  return encodeURI(t)
}

export function parseIgMediaType(url: string): 'p' | 'reel' | 'tv' {
  const parsedUrl = new URL(url)
  const hostname = parsedUrl.hostname.toLowerCase()

  if (
    hostname !== 'instagram.com' &&
    hostname !== 'www.instagram.com' &&
    hostname !== 'm.instagram.com'
  ) {
    throw new Error('Invalid Instagram domain')
  }

  const [mediaType, shortcode] = parsedUrl.pathname.split('/').filter(Boolean)
  const normalizedMediaType = mediaType === 'reels' ? 'reel' : mediaType

  if (
    !['p', 'reel', 'tv'].includes(normalizedMediaType) ||
    !/^[a-zA-Z0-9_-]+$/.test(shortcode ?? '')
  ) {
    throw new Error('No Shortcode Found in Url!')
  }

  return normalizedMediaType as 'p' | 'reel' | 'tv'
}

export function parseIgShortcode(url: string): string {
  parseIgMediaType(url)
  const parsedUrl = new URL(url)
  const [, shortcode] = parsedUrl.pathname.split('/').filter(Boolean)
  return shortcode
}

export function isValidIgUrl(url: any) {
  if (typeof url !== 'string') {
    return false
  }

  try {
    parseIgShortcode(url)
    return true
  } catch {
    return false
  }
}

/**
 * download file from url
 * @param url
 * @param filename
 */
export async function downloadVideo(url: string, filename: string) {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const videoBlob = new Blob([blob], { type: 'video/mp4' })
    const videoUrl = URL.createObjectURL(videoBlob)

    const link = document.createElement('a')
    link.href = videoUrl
    link.download = `${filename}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(videoUrl)
  } catch (error) {
    console.error('Error downloading file:', error)
  }
}

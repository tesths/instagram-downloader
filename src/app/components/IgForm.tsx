'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCallback, useEffect, useRef, useState } from 'react'
import axios, { AxiosError } from 'axios'
import { ResourceInfo } from '@/types'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { isValidIgUrl } from '@/lib/utils'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { POST_URL_PARAMS } from '@/lib/constant'

export default function IgForm({
  onGetData
}: {
  onGetData?: (res: ResourceInfo[]) => void
}) {
  const [postUrl, setPostUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()

  const updateSearchParams = useCallback((url: string) => {
    const newSearchParams = new URLSearchParams(searchParams.toString())
    newSearchParams.set(POST_URL_PARAMS, encodeURIComponent(url))
    router.push(`${pathname}?${newSearchParams.toString()}`)
  }, [pathname, router, searchParams])

  const getIgInfo = useCallback(async (url: string) => {
    try {
      setLoading(true)
      if (!isValidIgUrl(url)) {
        toast({
          title: 'Error',
          description: 'Not a valid Instagram link',
          duration: 1500
        })
        return
      }
      const res = await axios({
        url: `/api/ig?${POST_URL_PARAMS}=${encodeURIComponent(url)}`,
        method: 'get',
        timeout: 20000
      })
      if (res.status !== 200) {
        toast({
          title: 'Error',
          description: res.data.message,
          duration: 1500
        })
        return
      }
      updateSearchParams(url)
      onGetData?.(res.data.data)
    } catch (e) {
      console.log(e)
      toast({
        title: 'Error',
        description:
          ((e as AxiosError)?.response?.data as any)?.message ??
          ((e as AxiosError).code === 'ECONNABORTED'
            ? 'Instagram request timed out. Please try again.'
            : (e as AxiosError).message),
        duration: 1500
      })
    } finally {
      setLoading(false)
    }
  }, [onGetData, toast, updateSearchParams])

  const initialLoadRef = useRef(false)

  useEffect(() => {
    if (initialLoadRef.current) return
    initialLoadRef.current = true

    const url = searchParams.get(POST_URL_PARAMS)
    if (url) {
      const decoded = decodeURIComponent(url)
      setPostUrl(decoded)
      getIgInfo(decoded)
    }
  }, [getIgInfo, searchParams])

  const onClear = () => {
    setPostUrl('')
  }

  const onPaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setPostUrl(text)
    } catch {
      toast({
        title: 'Error',
        description: 'Please allow clipboard access.',
        duration: 1500
      })
    }
  }
  return (
    <>
      <div className="flex items-center space-x-2">
        <Input
          type="text"
          placeholder="Paste Instagram Link here"
          value={postUrl}
          onChange={(e) => setPostUrl(e.target.value)}
        />
        {postUrl && <Button variant="outline" onClick={onClear}>Clear</Button>}
        {!postUrl && <Button variant="outline" onClick={onPaste}>Paste</Button>}
      </div>
      <Button className="mt-4" onClick={() => getIgInfo(postUrl)} disabled={loading} variant="outline">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? 'Fetching...' : 'Download'}
      </Button>
    </>
  )
}

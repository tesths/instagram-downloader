'use client'
import IgForm from '@/app/components/IgForm'
import { useState, useEffect } from 'react'
import { ResourceInfo } from '@/types'
import { downloadVideo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'

function Save(props: { href: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const download = async () => {
    try {
      setIsLoading(true)
      await downloadVideo(props.href, `instagram-${new Date().toLocaleString('en-US')}`)
    } catch (error) {
      console.error(error)
      toast({
        title: 'Error',
        description: 'An Error occurred while downloading',
        duration: 1500
      })
    } finally { 
      setIsLoading(false)
    }
  }
  return (
    <Button
      variant="outline"
      className='mt-2'
      size="sm"
      onClick={download}
      disabled={isLoading}
    >
      {isLoading && <Loader2 className="animate-spin" />}
      Click To Save
    </Button>
  )
}

export default function Content() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister()
        })
      }).catch((err) => {
        console.error('Service worker cleanup failed:', err)
      })
    }
  }, [])

  const [resourceInfo, setResourceInfo] = useState<ResourceInfo[]>([])
  const { toast } = useToast()

  const copyLinkToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      toast({
        description: 'Download Link has been copied to clipboard',
        duration: 1500
      })
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
      <IgForm onGetData={setResourceInfo} />
      <div className="flex flex-col  gap-y-4 mt-8">
        {resourceInfo.length > 0 && (
          <Button
            variant="ghost"
            className="ml-auto"
            size="icon"
            onClick={() => copyLinkToClipboard()}
          >
            <ExternalLink />
          </Button>
        )}
        {resourceInfo.map((info, i) => {
          if (info.type === 'Image') {
            return (
              <div key={info.url}>
                <Image
                  src={info.url}
                  width={info.width || 1080}
                  height={info.height || 1080}
                  className="object-contain w-full h-[400px]"
                  alt={`Instagram image ${i + 1}`}
                  unoptimized
                />
              </div>
            )
          } else if (info.type === 'Video') {
            return (
              <div key={info.url}>
                <video
                  className="w-full h-[400px] rounded-b"
                  controls
                  playsInline={true}
                  preload="metadata"
                  muted
                  loop={true}
                >
                  <source src={info.url} type="video/mp4" />
                </video>
                <Save href={info.url} />
              </div>
            )
          }
        })}
      </div>
    </>
  )
}

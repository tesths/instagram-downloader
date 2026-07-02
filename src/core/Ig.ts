import axios from 'axios'
import { InstagramV1MediaItem, MediaData, ResourceInfo } from '@/types'
import dayjs from 'dayjs'
import { parseIgMediaType, parseIgShortcode } from '../lib/utils'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
}

const GRAPHQL_HEADERS = {
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.5',
  'Content-Type': 'application/x-www-form-urlencoded',
  'X-FB-Friendly-Name': 'PolarisPostActionLoadPostQueryQuery',
  'X-ASBD-ID': '129477',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

const DOC_IDS = ['10015901848480474', '8844121580391128', '8844121580391129']
const INSTAGRAM_REQUEST_TIMEOUT = 5000

type ApiMediaPayload = Record<string, any>

export default class Ig {
  public shortcode: string | null = null
  private mediaType: 'p' | 'reel' | 'tv' = 'p'

  constructor(url?: string) {
    if (url) {
      this.shortcode = this.parseShortcodeFromUrl(url)
      this.mediaType = parseIgMediaType(url)
    }
  }

  public async getData(shortcode?: string): Promise<ResourceInfo[]> {
    if (shortcode) {
      this.shortcode = shortcode
    }
    if (!this.shortcode) {
      throw new Error('Url or Shortcode is Not Defined')
    }

    const errors: string[] = []

    for (const strategy of [
      this.fetchViaEmbed.bind(this),
      this.fetchViaA1Endpoint.bind(this),
      this.fetchViaGraphQL.bind(this),
      this.fetchViaMediaEndpoint.bind(this)
    ]) {
      try {
        const mediaData = await strategy()
        if (mediaData) {
          const resourceInfo = this.filterUsableResources(
            this.formatToResourceInfo(mediaData)
          )
          if (resourceInfo.length > 0) {
            return resourceInfo
          }
          errors.push('Strategy returned no usable media URLs')
        }
      } catch (e) {
        errors.push((e as Error).message)
      }
    }

    throw new Error(`All strategies failed: ${errors.join('; ')}`)
  }

  private async fetchViaEmbed(): Promise<MediaData | InstagramV1MediaItem> {
    const paths = this.getEmbedPaths()
    const errors: string[] = []

    for (const path of paths) {
      try {
        const res = await axios.get(`https://www.instagram.com${path}`, {
          headers: {
            ...BROWSER_HEADERS,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            Referer: 'https://www.instagram.com/'
          },
          timeout: INSTAGRAM_REQUEST_TIMEOUT
        })
        if (res.status !== 200 || typeof res.data !== 'string') {
          throw new Error(`Embed endpoint failed for ${path}`)
        }

        const media = this.extractMediaFromEmbedHtml(res.data)
        if (media) return media
        throw new Error(`No media data in embed response for ${path}`)
      } catch (e) {
        errors.push((e as Error).message)
      }
    }

    throw new Error(`Embed strategies exhausted: ${errors.join('; ')}`)
  }

  private async fetchViaMediaEndpoint(): Promise<MediaData> {
    const url = `https://www.instagram.com/p/${this.shortcode}/media/?size=l`
    const res = await axios.get(url, {
      headers: {
        ...BROWSER_HEADERS,
        Accept:
          'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      maxRedirects: 0,
      timeout: INSTAGRAM_REQUEST_TIMEOUT,
      validateStatus: (status) => status >= 200 && status < 400
    })

    const mediaUrl =
      res.headers.location ||
      (res.request?.res?.responseUrl !== url ? res.request?.res?.responseUrl : '')

    if (!this.isHttpUrl(mediaUrl)) {
      throw new Error('No media URL in /media redirect response')
    }

    return {
      __typename: 'XDTGraphImage',
      __isXDTGraphMediaInterface: 'XDTGraphImage',
      id: this.shortcode || '',
      shortcode: this.shortcode || '',
      thumbnail_src: mediaUrl,
      dimensions: { height: 0, width: 0 },
      gating_info: null,
      fact_check_overall_rating: null,
      fact_check_information: null,
      sensitivity_friction_info: null,
      sharing_friction_info: {
        should_have_sharing_friction: false,
        bloks_app_url: null
      },
      media_overlay_info: null,
      media_preview: '',
      display_url: mediaUrl,
      display_resources: [
        {
          src: mediaUrl,
          config_width: 0,
          config_height: 0
        }
      ],
      accessibility_caption: null,
      dash_info: {
        is_dash_eligible: false,
        video_dash_manifest: null,
        number_of_qualities: 0
      },
      has_audio: false,
      video_url: '',
      video_view_count: 0,
      video_play_count: null,
      encoding_status: null,
      is_published: true,
      product_type: '',
      title: '',
      video_duration: 0,
      clips_music_attribution_info: {
        artist_name: '',
        song_name: '',
        uses_original_audio: false,
        should_mute_audio: false,
        should_mute_audio_reason: '',
        audio_id: ''
      },
      is_video: false,
      tracking_token: '',
      upcoming_event: null,
      edge_media_to_tagged_user: { edges: [] },
      owner: {
        id: '',
        username: '',
        is_verified: false,
        profile_pic_url: '',
        blocked_by_viewer: false,
        restricted_by_viewer: null,
        followed_by_viewer: false,
        full_name: '',
        has_blocked_viewer: false,
        is_embeds_disabled: false,
        is_private: false,
        is_unpublished: false,
        requested_by_viewer: false,
        pass_tiering_recommendation: false,
        edge_owner_to_timeline_media: { count: 0 },
        edge_followed_by: { count: 0 }
      },
      edge_media_to_caption: { edges: [] },
      can_see_insights_as_brand: false,
      caption_is_edited: false,
      has_ranked_comments: false,
      like_and_view_counts_disabled: false,
      edge_media_to_comment: {
        count: 0,
        page_info: { has_next_page: false, end_cursor: '' },
        edges: []
      },
      comments_disabled: false,
      commenting_disabled_for_viewer: false,
      taken_at_timestamp: Math.floor(Date.now() / 1000),
      edge_media_preview_like: { count: 0, edges: [] },
      edge_media_to_sponsor_user: { edges: [] },
      is_affiliate: false,
      is_paid_partnership: false,
      location: null,
      nft_asset_info: null,
      viewer_has_liked: false,
      viewer_has_saved: false,
      viewer_has_saved_to_collection: false,
      viewer_in_photo_of_you: false,
      viewer_can_reshare: true,
      is_ad: false,
      edge_web_media_to_related_media: { edges: [] },
      coauthor_producers: [],
      pinned_for_users: [],
      edge_related_profiles: { edges: [] }
    } as MediaData
  }

  private async fetchViaA1Endpoint(): Promise<MediaData | InstagramV1MediaItem> {
    const url = `https://www.instagram.com/p/${this.shortcode}/?__a=1&__d=1`
    const res = await axios.get(url, {
      headers: {
        ...BROWSER_HEADERS,
        'X-IG-App-ID': '1217981644879628',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: INSTAGRAM_REQUEST_TIMEOUT
    })
    if (res.status !== 200) throw new Error('A1 endpoint failed')
    if (!this.isJsonPayload(res.data)) {
      throw new Error('A1 endpoint returned non-JSON response')
    }
    const media = this.extractMediaFromApiPayload(res.data)
    if (media) return media
    throw new Error('No media data in A1 response')
  }

  private async fetchViaGraphQL(): Promise<MediaData | InstagramV1MediaItem> {
    const tokens = await this.fetchPageTokens()

    for (const doc_id of DOC_IDS) {
      try {
        const requestData = {
          av: '0',
          __d: 'www',
          __user: '0',
          __a: '1',
          __req: '3',
          __hs: '19624.HYP:instagram_web_pkg.2.1..0.0',
          dpr: '3',
          __ccg: 'UNKNOWN',
          __rev: '1008824440',
          __s: 'xf44ne:zhh75g:xr51e7',
          __hsi: '7282217488877343271',
          __dyn:
            '7xeUmwlEnwn8K2WnFw9-2i5U4e0yoW3q32360CEbo1nEhw2nVE4W0om78b87C0yE5ufz81s8hwGwQwoEcE7O2l0Fwqo31w9a9x-0z8-U2zxe2GewGwso88cobEaU2eUlwhEe87q7-0iK2S3qazo7u1xwIw8O321LwTwKG1pg661pwr86C1mwraCg',
          __csr:
            'gZ3yFmJkillQvV6ybimnG8AmhqujGbLADgjyEOWz49z9XDlAXBJpC7Wy-vQTSvUGWGh5u8KibG44dBiigrgjDxGjU0150Q0848azk48N09C02IR0go4SaR70r8owyg9pU0V23hwiA0LQczA48S0f-x-27o05NG0fkw',
          __comet_req: '7',
          lsd: tokens.lsdToken,
          jazoest: '2957',
          __spin_r: '1008824440',
          __spin_b: 'trunk',
          __spin_t: '1695523385',
          fb_api_caller_class: 'RelayModern',
          fb_api_req_friendly_name: 'PolarisPostActionLoadPostQueryQuery',
          variables: JSON.stringify({
            shortcode: this.shortcode,
            fetch_comment_count: 'null',
            fetch_related_profile_media_count: 'null',
            parent_comment_count: 'null',
            child_comment_count: 'null',
            fetch_like_count: 'null',
            fetch_tagged_user_count: 'null',
            fetch_preview_comment_count: 'null',
            has_threaded_comments: 'false',
            hoisted_comment_id: 'null',
            hoisted_reply_id: 'null'
          }),
          server_timestamps: 'true',
          doc_id
        }

        const res = await axios({
          url: 'https://www.instagram.com/api/graphql',
          method: 'post',
          headers: {
            ...GRAPHQL_HEADERS,
            'X-CSRFToken': tokens.csrfToken,
            'X-IG-App-ID': tokens.igAppId,
            'X-FB-LSD': tokens.lsdToken
          },
          data: new URLSearchParams(requestData).toString(),
          timeout: INSTAGRAM_REQUEST_TIMEOUT
        })

        if (res.status === 200 && this.isJsonPayload(res.data)) {
          const media = this.extractMediaFromApiPayload(res.data)
          if (media) return media
        }
      } catch {
        continue
      }
    }
    throw new Error('GraphQL strategies exhausted')
  }

  private async fetchPageTokens(): Promise<{
    lsdToken: string
    csrfToken: string
    igAppId: string
  }> {
    return {
      lsdToken: process.env.IG_LSD_TOKEN || 'AVqbxe3J_YA',
      csrfToken: process.env.IG_CSRF_TOKEN || 'RVDUooU5MYsBbS1CNN3CzVAuEP8oHB52',
      igAppId: process.env.IG_APP_ID || '1217981644879628'
    }
  }

  private extractMediaFromApiPayload(
    payload: ApiMediaPayload
  ): MediaData | InstagramV1MediaItem | null {
    if (!this.isJsonPayload(payload)) return null

    return (
      payload?.xdt_shortcode_media ||
      payload?.graphql?.shortcode_media ||
      payload?.data?.xdt_shortcode_media ||
      payload?.data?.shortcode_media ||
      payload?.data?.xdt_api__v1__media__shortcode__web_info?.items?.[0] ||
      payload?.xdt_api__v1__media__shortcode__web_info?.items?.[0] ||
      payload?.items?.[0] ||
      null
    )
  }

  private isJsonPayload(payload: unknown): payload is ApiMediaPayload {
    return payload !== null && typeof payload === 'object' && !Array.isArray(payload)
  }

  private getEmbedPaths(): string[] {
    const pathType = this.mediaType === 'tv' ? 'tv' : this.mediaType === 'reel' ? 'reel' : 'p'
    return [
      `/${pathType}/${this.shortcode}/embed/captioned/`,
      `/${pathType}/${this.shortcode}/embed/`
    ]
  }

  private extractMediaFromEmbedHtml(
    html: string
  ): MediaData | InstagramV1MediaItem | null {
    const contextJson = this.extractEmbedContextJson(html)
    if (!contextJson) return null

    try {
      const payload = JSON.parse(contextJson)
      return (
        payload?.gql_data?.shortcode_media ||
        payload?.shortcode_media ||
        this.extractMediaFromApiPayload(payload)
      )
    } catch {
      return null
    }
  }

  private extractEmbedContextJson(html: string): string | null {
    const marker = 'contextJSON'
    const mediaIndex = html.indexOf('shortcode_media')
    const searchEnd = mediaIndex === -1 ? html.length : mediaIndex
    const markerIndex = html.lastIndexOf(marker, searchEnd)
    if (markerIndex === -1) return null

    const colonIndex = html.indexOf(':', markerIndex + marker.length)
    if (colonIndex === -1) return null

    const quoteIndex = this.findNextQuote(html, colonIndex + 1)
    if (quoteIndex === -1) return null

    let escaped = false
    let raw = ''

    for (let i = quoteIndex + 1; i < html.length; i++) {
      const char = html[i]
      if (escaped) {
        raw += `\\${char}`
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        try {
          return JSON.parse(`"${raw}"`)
        } catch {
          return null
        }
      }
      raw += char
    }

    return null
  }

  private findNextQuote(value: string, start: number): number {
    for (let i = start; i < value.length; i++) {
      if (value[i] === '"') return i
      if (!/\s/.test(value[i])) return -1
    }
    return -1
  }

  public formatToResourceInfo(
    mediaData?: MediaData | InstagramV1MediaItem
  ): ResourceInfo[] {
    if (!mediaData) {
      return []
    }

    if (this.isInstagramV1MediaItem(mediaData)) {
      return this.formatV1MediaItemToResourceInfo(mediaData)
    }

    const nodes = mediaData.edge_sidecar_to_children
    if (nodes) {
      return nodes.edges.flatMap((node) => this.formatToResourceInfo(node.node))
    }
    if (mediaData.is_video) {
      const dashUrl = this.extractLargestDashVideoUrl(
        mediaData.dash_info?.video_dash_manifest
      )
      return [
        {
          filename: this.buildFilename('video', mediaData.id, 'mp4'),
          width: mediaData.dimensions.width,
          height: mediaData.dimensions.height,
          url: mediaData.video_url || dashUrl,
          type: 'Video' as const
        }
      ]
    } else {
      const imageData = this.pickLargestDisplayResource(
        mediaData.display_resources
      )
      return [
        {
          filename: this.buildFilename('img', mediaData.id, 'jpeg'),
          width: imageData?.config_width ?? mediaData.dimensions?.width ?? 0,
          height: imageData?.config_height ?? mediaData.dimensions?.height ?? 0,
          url: imageData?.src ?? mediaData.display_url ?? '',
          type: 'Image' as const
        }
      ]
    }
  }

  private formatV1MediaItemToResourceInfo(
    mediaData: InstagramV1MediaItem
  ): ResourceInfo[] {
    if (mediaData.media_type === 8) {
      return (mediaData.carousel_media ?? []).flatMap((item, index) =>
        this.formatV1MediaItemToResourceInfo({
          ...item,
          id: item.id ?? `${mediaData.id ?? mediaData.code ?? 'carousel'}-${index}`
        })
      )
    }

    if (mediaData.media_type === 2) {
      const video = this.pickLargestV1Candidate(mediaData.video_versions)
      return [
        {
          filename: this.buildFilename('video', mediaData.id, 'mp4'),
          width: video?.width ?? mediaData.original_width ?? 0,
          height: video?.height ?? mediaData.original_height ?? 0,
          url: video?.url ?? '',
          type: 'Video'
        }
      ]
    }

    const image = this.pickLargestV1Candidate(
      mediaData.image_versions2?.candidates
    )
    return [
      {
        filename: this.buildFilename('img', mediaData.id, 'jpeg'),
        width: image?.width ?? mediaData.original_width ?? 0,
        height: image?.height ?? mediaData.original_height ?? 0,
        url: image?.url ?? '',
        type: 'Image'
      }
    ]
  }

  private filterUsableResources(resources: ResourceInfo[]): ResourceInfo[] {
    return resources.filter((resource) => this.isHttpUrl(resource.url))
  }

  private isHttpUrl(url?: string): boolean {
    if (!url) return false
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  private isInstagramV1MediaItem(
    mediaData: MediaData | InstagramV1MediaItem
  ): mediaData is InstagramV1MediaItem {
    return typeof (mediaData as InstagramV1MediaItem).media_type === 'number'
  }

  private pickLargestV1Candidate<T extends { width?: number; height?: number }>(
    candidates?: T[]
  ): T | undefined {
    if (!candidates?.length) return undefined
    return [...candidates].sort(
      (a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0)
    )[0]
  }

  private pickLargestDisplayResource(
    candidates?: Array<{ src: string; config_width: number; config_height: number }>
  ) {
    if (!candidates?.length) return undefined
    return [...candidates].sort(
      (a, b) =>
        (b.config_width ?? 0) * (b.config_height ?? 0) -
        (a.config_width ?? 0) * (a.config_height ?? 0)
    )[0]
  }

  private extractLargestDashVideoUrl(manifest?: string | null): string {
    if (!manifest) return ''

    const representations = [...manifest.matchAll(/<Representation\b([\s\S]*?)<\/Representation>/g)]
      .map((match) => {
        const width = Number(match[1].match(/\bwidth="(\d+)"/)?.[1] ?? 0)
        const height = Number(match[1].match(/\bheight="(\d+)"/)?.[1] ?? 0)
        const encodedUrl = match[1].match(/<BaseURL>([\s\S]*?)<\/BaseURL>/)?.[1]
        return {
          width,
          height,
          url: encodedUrl ? this.decodeHtmlEntities(encodedUrl) : ''
        }
      })
      .filter((item) => this.isHttpUrl(item.url))

    return this.pickLargestV1Candidate(representations)?.url ?? ''
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
  }

  private buildFilename(
    prefix: 'img' | 'video',
    id: string | number | undefined,
    extension: 'jpeg' | 'mp4'
  ): string {
    const suffix = id ? `-${id}` : ''
    return `ig-${prefix}-${dayjs().format('YYYY-MM-DDTHH:mm:ss')}${suffix}.${extension}`
  }

  private parseShortcodeFromUrl(url: string): string {
    return parseIgShortcode(url)
  }
}

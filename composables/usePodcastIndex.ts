const PODCAST_INDEX_BASE = 'https://api.podcastindex.org/api/1.0'

export interface PodcastIndexFeed {
  id: number
  url: string
  title: string
  description: string
  author: string
  image: string
  artwork: string
  categories?: Record<string, string>
  explicit: boolean
  episodeCount: number
}

async function sha1Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message)
  const buf = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function buildHeaders(apiKey: string, apiSecret: string) {
  const ts = Math.floor(Date.now() / 1000)
  const hash = await sha1Hex(`${apiKey}${apiSecret}${ts}`)
  return {
    'X-Auth-Key': apiKey,
    'X-Auth-Date': String(ts),
    Authorization: hash,
    'User-Agent': 'audiobookshelf-app/1.0',
  }
}

export function usePodcastIndex() {
  const config = useRuntimeConfig()
  const apiKey = config.public.PODCAST_INDEX_KEY as string
  const apiSecret = config.public.PODCAST_INDEX_SECRET as string

  const isConfigured = computed(() => !!apiKey && !!apiSecret)

  async function fetchTrending(options: { max?: number; category?: string; lang?: string } = {}): Promise<PodcastIndexFeed[]> {
    if (!apiKey || !apiSecret) return []

    const params = new URLSearchParams({
      max: String(options.max ?? 15),
      lang: options.lang ?? 'en',
    })
    if (options.category) params.set('cat', options.category)

    try {
      const headers = await buildHeaders(apiKey, apiSecret)
      const res = await fetch(`${PODCAST_INDEX_BASE}/podcasts/trending?${params}`, { headers })
      if (!res.ok) return []
      const data = await res.json() as { feeds?: PodcastIndexFeed[] }
      return data?.feeds ?? []
    } catch {
      return []
    }
  }

  return { isConfigured, fetchTrending }
}

import { CapacitorHttp } from '@capacitor/core'

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

export type PodcastIndexResult =
  | { ok: true; feeds: PodcastIndexFeed[] }
  | { ok: false; reason: PodcastIndexFailure }

export type PodcastIndexFailure = 'not-configured' | 'rejected' | 'rate-limited' | 'unreachable' | 'server-error'

/**
 * Why a Podcast Index request failed, in terms a person can act on.
 *
 * Pure and exported so the mapping is testable: the alternative is reading a status code off a
 * live third-party API, which is exactly the kind of thing that cannot be exercised and so went
 * unnoticed for as long as it did.
 */
export function describePodcastIndexFailure(status: number): PodcastIndexFailure {
  if (status === 401 || status === 403) return 'rejected'
  if (status === 429) return 'rate-limited'
  if (status >= 500) return 'server-error'
  // 400 included: Podcast Index answers a missing or unacceptable User-Agent with 400, which is
  // a fault in this app rather than anything the person did.
  return 'rejected'
}

async function sha1Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message)
  const buf = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function usePodcastIndex() {
  const config = useRuntimeConfig()
  const apiKey = config.public.PODCAST_INDEX_KEY as string
  const apiSecret = config.public.PODCAST_INDEX_SECRET as string
  const version = (config.public.version as string) || '0.0.0'

  const isConfigured = computed(() => !!apiKey && !!apiSecret)

  /**
   * Podcast Index refuses requests without a User-Agent that names the application, and says so
   * with a 400 or a 403. A browser cannot send one: User-Agent is a forbidden header name, so
   * fetch() silently drops it. That, plus the API sending no Access-Control-Allow-Origin at all,
   * is why this has to go through the native HTTP client rather than fetch - two independent
   * reasons, either of which alone would be enough.
   *
   * CapacitorHttp directly rather than useNativeHttp: that wrapper is for the user's own server.
   * It sets appStore.serverReachable from the response and retries a 401 by refreshing the
   * server token, neither of which a third-party host should be driving.
   */
  async function request(path: string, params: URLSearchParams): Promise<PodcastIndexResult> {
    if (!apiKey || !apiSecret) return { ok: false, reason: 'not-configured' }

    const ts = Math.floor(Date.now() / 1000)
    const authorization = await sha1Hex(`${apiKey}${apiSecret}${ts}`)

    try {
      const res = await CapacitorHttp.request({
        method: 'GET',
        url: `${PODCAST_INDEX_BASE}${path}?${params}`,
        headers: {
          'X-Auth-Key': apiKey,
          'X-Auth-Date': String(ts),
          Authorization: authorization,
          // Must identify the app. Podcast Index rejects sample-code, default-library and
          // vague strings by name in its own error message.
          'User-Agent': `Podshelf/${version} (+https://github.com/yougotborked/podshelf-app)`
        },
        connectTimeout: 10000
      })

      if (res.status >= 400) {
        console.error(`[podcastIndex] ${path} failed with ${res.status}`, res.data)
        return { ok: false, reason: describePodcastIndexFailure(res.status) }
      }

      const data = (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as { feeds?: PodcastIndexFeed[] }
      return { ok: true, feeds: data?.feeds ?? [] }
    } catch (error) {
      // No status means it never reached them - no signal, captive portal, DNS.
      console.error(`[podcastIndex] ${path} did not complete`, error)
      return { ok: false, reason: 'unreachable' }
    }
  }

  function fetchTrending(options: { max?: number; category?: string; lang?: string } = {}): Promise<PodcastIndexResult> {
    const params = new URLSearchParams({
      max: String(options.max ?? 15),
      lang: options.lang ?? 'en'
    })
    if (options.category) params.set('cat', options.category)
    return request('/podcasts/trending', params)
  }

  return { isConfigured, fetchTrending }
}

// Utility functions ported from mixins/autoPlaylistHelpers.js

function toEpisodeMetadataMap(metadataEntries: Record<string, unknown>[] = []): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>()
  metadataEntries.forEach((entry) => {
    if (entry && entry.id) map.set(entry.id as string, entry)
  })
  return map
}

function mergeEpisodeMetadata(
  episodes: Record<string, unknown>[] = [],
  metadataMap: Map<string, Record<string, unknown>> | undefined
): Record<string, unknown>[] {
  if (!metadataMap || !metadataMap.size) return [...episodes]
  return episodes.map((episode) => {
    const serverId = (episode?.serverEpisodeId || episode?.id) as string | undefined
    if (!serverId) return episode
    if (episode.publishedAt || episode.pubDate) return episode
    const metadata = metadataMap.get(serverId)
    if (!metadata) return episode
    return { ...episode, publishedAt: metadata.publishedAt, pubDate: metadata.pubDate }
  })
}

async function fetchServerEpisodesInBatches(
  contexts: Array<{
    libraryId: string
    localEpisodeMap: Map<string, Record<string, unknown>>
    episodes: Record<string, unknown>[]
    useLocalEpisodesFallback(): void
  }>,
  nativeHttp: ReturnType<typeof useNativeHttp>,
  localStore: ReturnType<typeof useLocalStore>
): Promise<void> {
  if (!contexts.length) return
  const metadataWrites: Promise<void>[] = []
  const batchSize = 4

  for (let i = 0; i < contexts.length; i += batchSize) {
    const batch = contexts.slice(i, i + batchSize)
    const responses = await Promise.allSettled(
      batch.map((context) => nativeHttp.get(`/api/items/${context.libraryId}?expanded=1`))
    )
    responses.forEach((result, index) => {
      const context = batch[index]
      if (result.status !== 'fulfilled') { context.useLocalEpisodesFallback(); return }
      const serverItem = result.value as Record<string, unknown>
      const serverEpisodes = (serverItem?.media as Record<string, unknown>)?.episodes as Record<string, unknown>[] | undefined
      if (!Array.isArray(serverEpisodes) || !serverEpisodes.length) { context.useLocalEpisodesFallback(); return }

      context.episodes = serverEpisodes.map((serverEpisode) => {
        const localEpisode = context.localEpisodeMap.get(serverEpisode.id as string)
        return localEpisode ? { ...serverEpisode, localEpisode } : serverEpisode
      })
      const metadataForCache = serverEpisodes.map((serverEpisode) => ({
        id: serverEpisode.id,
        pubDate: serverEpisode.pubDate,
        publishedAt: serverEpisode.publishedAt
      }))
      metadataWrites.push(localStore.setEpisodeMetadata(context.libraryId, metadataForCache))
    })
  }
  if (metadataWrites.length) await Promise.allSettled(metadataWrites)
}

function getEpisodeSortDate(episode: Record<string, unknown>): number {
  if (!episode) return 0
  let value = episode.publishedAt ?? episode.pubDate
  if (!value) return 0
  if (typeof value === 'string') {
    const numeric = Number(value)
    if (!Number.isNaN(numeric)) value = numeric
  }
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value
  const parsed = Date.parse(value as string)
  return Number.isNaN(parsed) ? 0 : parsed
}

const MAX_AUTO_PLAYLIST_ITEMS = 400

function sanitizeTracks(tracks: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!Array.isArray(tracks) || !tracks.length) return tracks
  return tracks.map((track) => {
    if (!track || typeof track !== 'object') return track
    const { chapters: _chapters, ...rest } = track as { chapters?: unknown; [k: string]: unknown }
    return rest
  })
}

function createPlaylistLibraryItem(libraryItem: Record<string, unknown> | null, libraryId: string): Record<string, unknown> {
  const resolvedLibraryId = libraryId || (libraryItem?.libraryItemId as string) || (libraryItem?.id as string)
  if (!libraryItem) return { id: resolvedLibraryId, libraryItemId: resolvedLibraryId }
  const { media, ...rest } = libraryItem as { media?: Record<string, unknown>; [k: string]: unknown }
  const sanitizedMedia = media ? { ...media } : undefined
  if (sanitizedMedia) {
    delete sanitizedMedia.episodes
    delete sanitizedMedia.chapters
    if (sanitizedMedia.tracks) sanitizedMedia.tracks = sanitizeTracks(sanitizedMedia.tracks as Record<string, unknown>[])
  }
  return { ...rest, id: resolvedLibraryId, libraryItemId: resolvedLibraryId, media: sanitizedMedia }
}

function createPlaylistEpisode(episode: Record<string, unknown>): Record<string, unknown> | null {
  if (!episode) return null
  const { localEpisode: _localEpisode, chapters: _chapters, waveform: _waveform, ...rest } = episode as {
    localEpisode?: unknown; chapters?: unknown; waveform?: unknown; [k: string]: unknown
  }
  return { ...rest }
}

function sanitizeLocalEpisode(localEpisode: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!localEpisode) return null
  const { id, serverEpisodeId, localLibraryItemId, title, pubDate, publishedAt, duration, fileSize, audioTrack } = localEpisode as Record<string, unknown>
  return {
    id, serverEpisodeId, localLibraryItemId, title, pubDate, publishedAt, duration, fileSize,
    audioTrack: audioTrack ? { ...(audioTrack as Record<string, unknown>) } : undefined
  }
}

export function toCacheablePlaylist(playlist: Record<string, unknown>): Record<string, unknown> {
  if (!playlist) return playlist
  return {
    ...playlist,
    items: ((playlist.items as Record<string, unknown>[]) || []).map((item) => {
      const { localLibraryItem, localEpisode, ...rest } = (item || {}) as {
        localLibraryItem?: Record<string, unknown>; localEpisode?: Record<string, unknown>; [k: string]: unknown
      }
      const sanitized: Record<string, unknown> = { ...rest }
      if (localLibraryItem) {
        sanitized.localLibraryItem = createPlaylistLibraryItem(
          localLibraryItem,
          (localLibraryItem.libraryItemId || localLibraryItem.id || rest.libraryItemId) as string
        )
      }
      if (localEpisode) sanitized.localEpisode = sanitizeLocalEpisode(localEpisode)
      return sanitized
    })
  }
}

export function collectDownloadedEpisodeKeys(localLibraries: Record<string, unknown>[] = []): Set<string> {
  const keys = new Set<string>()
  localLibraries.forEach((libraryItem) => {
    const libraryId = (libraryItem?.libraryItemId || libraryItem?.id) as string
    if (!libraryId) return
    const episodes = ((libraryItem?.media as Record<string, unknown>)?.episodes as Record<string, unknown>[]) || []
    episodes.forEach((episode) => {
      const serverId = (episode?.serverEpisodeId || episode?.id) as string
      if (!serverId) return
      keys.add(`${libraryId}_${serverId}`)
    })
  })
  return keys
}

export async function buildUnfinishedAutoPlaylist(networkConnected: boolean): Promise<{
  items: Record<string, unknown>[]
  downloadedEpisodeKeys: Set<string>
  totalItems: number
}> {
  const userStore = useUserStore()
  const globalsStore = useGlobalsStore()
  const db = useDb()
  const localStore = useLocalStore()
  const nativeHttp = useNativeHttp()

  const progressMap = new Map<string, Record<string, unknown>>()
  ;((userStore.user?.mediaProgress as Record<string, unknown>[]) || []).forEach((progress) => {
    if (progress?.episodeId) progressMap.set(progress.episodeId as string, progress)
  })
  ;(globalsStore.localMediaProgress || []).forEach((progress) => {
    if ((progress as Record<string, unknown>)?.episodeId) {
      progressMap.set((progress as Record<string, unknown>).episodeId as string, progress as Record<string, unknown>)
    }
  })

  const localLibraries = await db.getLocalLibraryItems('podcast') as Record<string, unknown>[]
  const downloadedEpisodeKeys = collectDownloadedEpisodeKeys(localLibraries)

  const hasServerConnection = !!(userStore.serverConnectionConfig?.address && userStore.accessToken)
  const canFetchServerEpisodes = networkConnected && hasServerConnection

  const metadataResults = await Promise.allSettled(
    localLibraries.map((libraryItem) => {
      const libraryId = (libraryItem?.libraryItemId || libraryItem?.id) as string
      return libraryId ? localStore.getEpisodeMetadata(libraryId) : Promise.resolve([])
    })
  )

  const metadataByLibraryId = new Map<string, Map<string, Record<string, unknown>>>()
  metadataResults.forEach((result, index) => {
    const libraryItem = localLibraries[index]
    if (!libraryItem) return
    const libraryId = (libraryItem.libraryItemId || libraryItem.id) as string
    if (!libraryId) return
    const entries = result.status === 'fulfilled' && Array.isArray(result.value) ? result.value as Record<string, unknown>[] : []
    metadataByLibraryId.set(libraryId, toEpisodeMetadataMap(entries))
  })

  const playlistItems: Array<Record<string, unknown> & { sortDate: number }> = []
  const seen = new Set<string>()
  const libraryContexts: Array<{
    libraryItem: Record<string, unknown>
    libraryId: string
    localEpisodeMap: Map<string, Record<string, unknown>>
    episodes: Record<string, unknown>[]
    needsServerDates: boolean
    useLocalEpisodesFallback(): void
  }> = []

  localLibraries.forEach((libraryItem) => {
    const libraryId = (libraryItem.libraryItemId || libraryItem.id) as string
    const localEpisodes = ((libraryItem?.media as Record<string, unknown>)?.episodes as Record<string, unknown>[]) || []
    const metadataMap = metadataByLibraryId.get(libraryId)

    const localEpisodeMap = new Map<string, Record<string, unknown>>()
    localEpisodes.forEach((episode) => {
      const serverId = (episode?.serverEpisodeId || episode?.id) as string
      if (serverId) localEpisodeMap.set(serverId, episode)
    })

    const context = {
      libraryItem,
      libraryId,
      localEpisodeMap,
      episodes: mergeEpisodeMetadata(localEpisodes, metadataMap),
      needsServerDates: false,
      useLocalEpisodesFallback() {
        this.episodes = this.episodes.map((episode) => {
          const serverId = (episode?.serverEpisodeId || episode?.id) as string
          if (!serverId || episode.localEpisode) return episode
          const localEpisode = this.localEpisodeMap.get(serverId)
          return localEpisode ? { ...episode, localEpisode } : episode
        })
      }
    }

    const needsServerDates = canFetchServerEpisodes && context.episodes.some((episode) => !episode?.publishedAt && !episode?.pubDate)
    context.needsServerDates = needsServerDates
    if (!needsServerDates) context.useLocalEpisodesFallback()
    libraryContexts.push(context)
  })

  const contextsNeedingServerData = canFetchServerEpisodes ? libraryContexts.filter((c) => c.needsServerDates) : []
  if (contextsNeedingServerData.length) await fetchServerEpisodesInBatches(contextsNeedingServerData, nativeHttp, localStore)

  libraryContexts.forEach((context) => {
    const { libraryItem, libraryId, localEpisodeMap } = context
    context.episodes.forEach((episode) => {
      const serverId = (episode?.serverEpisodeId || episode?.id) as string
      if (!serverId) return
      const progress = progressMap.get(serverId)
      if ((progress as Record<string, unknown>)?.isFinished) return
      const key = `${libraryId}_${serverId}`
      if (seen.has(key)) return
      seen.add(key)
      const sortDate = getEpisodeSortDate(episode)
      const sanitizedEpisode = createPlaylistEpisode(episode)
      playlistItems.push({
        id: key,
        libraryItem: createPlaylistLibraryItem(libraryItem, libraryId),
        episode: sanitizedEpisode,
        libraryItemId: libraryId,
        episodeId: serverId,
        localLibraryItem: libraryItem,
        localEpisode: (episode.localEpisode as Record<string, unknown>) || localEpisodeMap.get(serverId) || null,
        sortDate
      })
    })
  })

  playlistItems.sort((a, b) => a.sortDate - b.sortDate)

  const totalItems = playlistItems.length
  let limitedItems: Record<string, unknown>[] = playlistItems
  if (playlistItems.length > MAX_AUTO_PLAYLIST_ITEMS) limitedItems = playlistItems.slice(-MAX_AUTO_PLAYLIST_ITEMS)
  limitedItems.forEach((item) => { delete item.sortDate })

  return { items: limitedItems, downloadedEpisodeKeys, totalItems }
}

export function useAutoPlaylist() {
  return { buildUnfinishedAutoPlaylist, toCacheablePlaylist, collectDownloadedEpisodeKeys }
}

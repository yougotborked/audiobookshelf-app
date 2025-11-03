function toEpisodeMetadataMap(metadataEntries = []) {
  const map = new Map()
  metadataEntries.forEach((entry) => {
    if (entry && entry.id) {
      map.set(entry.id, entry)
    }
  })
  return map
}

function mergeEpisodeMetadata(episodes = [], metadataMap) {
  if (!metadataMap || !metadataMap.size) {
    return [...episodes]
  }

  return episodes.map((episode) => {
    const serverId = episode?.serverEpisodeId || episode?.id
    if (!serverId) return episode
    if (episode.publishedAt || episode.pubDate) return episode

    const metadata = metadataMap.get(serverId)
    if (!metadata) return episode

    return {
      ...episode,
      publishedAt: metadata.publishedAt,
      pubDate: metadata.pubDate
    }
  })
}

async function fetchServerEpisodesInBatches(contexts, nativeHttp, localStore) {
  if (!contexts.length) return

  const metadataWrites = []
  const batchSize = 4

  for (let i = 0; i < contexts.length; i += batchSize) {
    const batch = contexts.slice(i, i + batchSize)
    const responses = await Promise.allSettled(
      batch.map((context) => nativeHttp.get(`/api/items/${context.libraryId}?expanded=1`))
    )

    responses.forEach((result, index) => {
      const context = batch[index]
      if (result.status !== 'fulfilled') {
        context.useLocalEpisodesFallback()
        return
      }

      const serverItem = result.value
      const serverEpisodes = serverItem?.media?.episodes
      if (!Array.isArray(serverEpisodes) || !serverEpisodes.length) {
        context.useLocalEpisodesFallback()
        return
      }

      context.episodes = serverEpisodes.map((serverEpisode) => {
        const localEpisode = context.localEpisodeMap.get(serverEpisode.id)
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

  if (metadataWrites.length) {
    await Promise.allSettled(metadataWrites)
  }
}

function getEpisodeSortDate(episode) {
  if (!episode) return 0
  let value = episode.publishedAt ?? episode.pubDate
  if (!value) return 0

  if (typeof value === 'string') {
    const numeric = Number(value)
    if (!Number.isNaN(numeric)) {
      value = numeric
    }
  }

  if (typeof value === 'number') {
    return value < 1e12 ? value * 1000 : value
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

const MAX_AUTO_PLAYLIST_ITEMS = 400

function sanitizeTracks(tracks = []) {
  if (!Array.isArray(tracks) || !tracks.length) return tracks
  return tracks.map((track) => {
    if (!track || typeof track !== 'object') return track
    const { chapters, ...rest } = track
    return rest
  })
}

function createPlaylistLibraryItem(libraryItem, libraryId) {
  if (!libraryItem) {
    return { id: libraryId, libraryItemId: libraryId }
  }

  const { media, ...rest } = libraryItem
  const sanitizedMedia = media ? { ...media } : undefined
  if (sanitizedMedia) {
    delete sanitizedMedia.episodes
    delete sanitizedMedia.chapters
    if (sanitizedMedia.tracks) {
      sanitizedMedia.tracks = sanitizeTracks(sanitizedMedia.tracks)
    }
  }

  return {
    ...rest,
    id: libraryId,
    libraryItemId: libraryId,
    media: sanitizedMedia
  }
}

function createPlaylistEpisode(episode) {
  if (!episode) return null

  const { localEpisode, chapters, waveform, ...rest } = episode
  return { ...rest }
}

export function toCacheablePlaylist(playlist) {
  if (!playlist) return playlist

  return {
    ...playlist,
    items: (playlist.items || []).map((item) => {
      const { localLibraryItem, localEpisode, ...rest } = item || {}
      return { ...rest }
    })
  }
}

export function collectDownloadedEpisodeKeys(localLibraries = []) {
  const keys = new Set()

  localLibraries.forEach((libraryItem) => {
    const episodes = libraryItem?.media?.episodes || []
    episodes.forEach((episode) => {
      const serverId = episode?.serverEpisodeId || episode?.id
      if (!serverId) return
      keys.add(`${libraryItem.libraryItemId}_${serverId}`)
    })
  })

  return keys
}

export async function buildUnfinishedAutoPlaylist({
  store,
  db,
  localStore,
  nativeHttp,
  networkConnected
}) {
  const progressMap = new Map()

  ;(store.state.user.user?.mediaProgress || []).forEach((progress) => {
    if (progress?.episodeId) {
      progressMap.set(progress.episodeId, progress)
    }
  })
  ;(store.state.globals.localMediaProgress || []).forEach((progress) => {
    if (progress?.episodeId) {
      progressMap.set(progress.episodeId, progress)
    }
  })

  const localLibraries = await db.getLocalLibraryItems('podcast')
  const downloadedEpisodeKeys = collectDownloadedEpisodeKeys(localLibraries)

  const metadataResults = await Promise.allSettled(
    localLibraries.map((libraryItem) => localStore.getEpisodeMetadata(libraryItem.libraryItemId))
  )

  const metadataByLibraryId = new Map()
  metadataResults.forEach((result, index) => {
    const libraryItem = localLibraries[index]
    if (!libraryItem) return
    const entries = result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []
    metadataByLibraryId.set(libraryItem.libraryItemId, toEpisodeMetadataMap(entries))
  })

  const playlistItems = []
  const seen = new Set()
  const libraryContexts = []

  localLibraries.forEach((libraryItem) => {
    const libraryId = libraryItem.libraryItemId
    const localEpisodes = libraryItem?.media?.episodes || []
    const metadataMap = metadataByLibraryId.get(libraryId)

    const localEpisodeMap = new Map()
    localEpisodes.forEach((episode) => {
      const serverId = episode?.serverEpisodeId || episode?.id
      if (serverId) {
        localEpisodeMap.set(serverId, episode)
      }
    })

    const context = {
      libraryItem,
      libraryId,
      localEpisodeMap,
      episodes: mergeEpisodeMetadata(localEpisodes, metadataMap),
      useLocalEpisodesFallback() {
        this.episodes = this.episodes.map((episode) => {
          const serverId = episode?.serverEpisodeId || episode?.id
          if (!serverId || episode.localEpisode) return episode
          const localEpisode = this.localEpisodeMap.get(serverId)
          return localEpisode ? { ...episode, localEpisode } : episode
        })
      }
    }

    const needsServerDates =
      networkConnected &&
      context.episodes.some((episode) => !episode?.publishedAt && !episode?.pubDate)

    if (needsServerDates) {
      libraryContexts.push({ ...context, needsServerDates: true })
    } else {
      context.useLocalEpisodesFallback()
      libraryContexts.push({ ...context, needsServerDates: false })
    }
  })

  const contextsNeedingServerData = libraryContexts.filter((context) => context.needsServerDates)
  await fetchServerEpisodesInBatches(contextsNeedingServerData, nativeHttp, localStore)

  libraryContexts.forEach((context) => {
    const { libraryItem, libraryId, localEpisodeMap } = context

    context.episodes.forEach((episode) => {
      const serverId = episode?.serverEpisodeId || episode?.id
      if (!serverId) return

      const progress = progressMap.get(serverId)
      if (progress?.isFinished) return

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
        localEpisode: episode.localEpisode || localEpisodeMap.get(serverId) || null,
        sortDate
      })
    })
  })

  playlistItems.sort((a, b) => a.sortDate - b.sortDate)

  const totalItems = playlistItems.length
  let limitedItems = playlistItems
  if (playlistItems.length > MAX_AUTO_PLAYLIST_ITEMS) {
    limitedItems = playlistItems.slice(-MAX_AUTO_PLAYLIST_ITEMS)
  }

  limitedItems.forEach((item) => {
    delete item.sortDate
  })

  return {
    items: limitedItems,
    downloadedEpisodeKeys,
    totalItems
  }
}

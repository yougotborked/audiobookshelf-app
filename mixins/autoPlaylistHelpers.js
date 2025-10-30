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

  for (const libraryItem of localLibraries) {
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

    let episodes = mergeEpisodeMetadata(localEpisodes, metadataMap)

    const needsServerDates =
      networkConnected &&
      episodes.some((episode) => !episode?.publishedAt && !episode?.pubDate)

    if (needsServerDates) {
      const serverItem = await nativeHttp
        .get(`/api/items/${libraryId}?expanded=1`)
        .catch(() => null)

      if (serverItem?.media?.episodes?.length) {
        episodes = serverItem.media.episodes.map((serverEpisode) => {
          const localEpisode = localEpisodeMap.get(serverEpisode.id)
          return localEpisode
            ? { ...serverEpisode, localEpisode }
            : serverEpisode
        })

        const metadataForCache = serverItem.media.episodes.map((serverEpisode) => ({
          id: serverEpisode.id,
          pubDate: serverEpisode.pubDate,
          publishedAt: serverEpisode.publishedAt
        }))
        await localStore.setEpisodeMetadata(libraryId, metadataForCache)
      }
    } else {
      episodes = episodes.map((episode) => {
        const serverId = episode?.serverEpisodeId || episode?.id
        if (!serverId || episode.localEpisode) return episode
        const localEpisode = localEpisodeMap.get(serverId)
        return localEpisode ? { ...episode, localEpisode } : episode
      })
    }

    for (const episode of episodes) {
      const serverId = episode?.serverEpisodeId || episode?.id
      if (!serverId) continue

      const progress = progressMap.get(serverId)
      if (progress?.isFinished) continue

      const key = `${libraryId}_${serverId}`
      if (seen.has(key)) continue
      seen.add(key)

      const sortDate = getEpisodeSortDate(episode)
      playlistItems.push({
        libraryItem: { ...libraryItem, id: libraryId },
        episode,
        libraryItemId: libraryId,
        episodeId: serverId,
        localLibraryItem: libraryItem,
        localEpisode: episode.localEpisode || localEpisodeMap.get(serverId) || null,
        sortDate
      })
    }
  }

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

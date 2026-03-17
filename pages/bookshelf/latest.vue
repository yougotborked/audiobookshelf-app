<template>
  <div class="w-full p-4">
    <h1 class="text-xl mb-2 font-semibold">{{ strings.HeaderLatestEpisodes }}</h1>

    <template v-for="episode in recentEpisodes">
      <tables-podcast-latest-episode-row :episode="episode" :local-episode="localEpisodeMap[episode.id]" :library-item-id="episode.libraryItemId" :local-library-item-id="localEpisodeMap[episode.id]?.localLibraryItemId" :key="episode.id" @addToPlaylist="addEpisodeToPlaylist" />
    </template>
  </div>
</template>

<script setup lang="ts">
const strings = useStrings()
const eventBus = useEventBus()
const nativeHttp = useNativeHttp()
const db = useDb()
const localStore = useLocalStore()
const toast = useToast()
const router = useRouter()

const librariesStore = useLibrariesStore()
const appStore = useAppStore()
const globalsStore = useGlobalsStore()

const processing = ref(false)
const recentEpisodes = ref<any[]>([])
const totalEpisodes = ref(0)
const currentPage = ref(0)
const localLibraryItems = ref<any[]>([])
const loadedLibraryId = ref<string | null>(null)
const reloadTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const offlineToastShown = ref(false)

const currentLibraryId = computed(() => librariesStore.currentLibraryId)
const networkConnected = computed(() => appStore.networkConnected)
const socketConnected = computed(() => appStore.socketConnected)
const serverReachable = computed(() => appStore.serverReachable)

const localEpisodes = computed(() => {
  const episodes: any[] = []
  localLibraryItems.value.forEach((li) => {
    if (li.media.episodes?.length) {
      li.media.episodes.map((ep: any) => {
        ep.localLibraryItemId = li.id
        episodes.push(ep)
      })
    }
  })
  return episodes
})

const localEpisodeMap = computed(() => {
  const epmap: Record<string, any> = {}
  localEpisodes.value.forEach((localEp) => {
    if (localEp.serverEpisodeId) {
      epmap[localEp.serverEpisodeId] = localEp
    }
  })
  return epmap
})

watch(networkConnected, (newVal) => {
  scheduleReload(newVal ? 800 : 0)
})

watch(socketConnected, (newVal) => {
  scheduleReload(newVal ? 800 : 0)
})

watch(serverReachable, (newVal) => {
  scheduleReload(newVal ? 600 : 0)
})

async function addEpisodeToPlaylist(episode: any) {
  const libraryItem = await nativeHttp.get(`/api/items/${episode.libraryItemId}`).catch((error: any) => {
    console.error('Failed to get library item', error)
    toast.error('Failed to get library item')
    return null
  })
  if (!libraryItem) return

  globalsStore.selectedPlaylistItems = [{ libraryItem, episode }]
  globalsStore.showPlaylistsAddCreateModal = true
}

async function loadRecentEpisodes(page = 0) {
  if (!currentLibraryId.value) return
  loadedLibraryId.value = currentLibraryId.value
  processing.value = true
  const shouldUseOffline = !networkConnected.value || !socketConnected.value || !serverReachable.value

  try {
    if (shouldUseOffline) {
      await useOfflineEpisodes({ showToast: networkConnected.value })
      return
    }

    const episodePayloadRaw = await nativeHttp.get(
      `/api/libraries/${currentLibraryId.value}/recent-episodes?limit=200&page=${page}`
    )

    if (!episodePayloadRaw) {
      throw new Error('Empty response payload')
    }

    const episodePayload = episodePayloadRaw as Record<string, unknown>
    console.log('Episodes', episodePayload)
    recentEpisodes.value = (episodePayload.episodes as any[]) || []
    totalEpisodes.value = (episodePayload.total as number) ?? recentEpisodes.value.length
    currentPage.value = page
    offlineToastShown.value = false
    localStore.setCachedLatestEpisodes(currentLibraryId.value, recentEpisodes.value)
  } catch (error) {
    console.error('Failed to get recent episodes', error)
    await useOfflineEpisodes({ showToast: true })
  } finally {
    processing.value = false
  }
}

async function useOfflineEpisodes({ showToast = false } = {}) {
  if (!localLibraryItems.value.length) {
    await loadLocalPodcastLibraryItems()
  }

  const cached = await localStore.getCachedLatestEpisodes(currentLibraryId.value)
  if (cached.length) {
    recentEpisodes.value = cached
    totalEpisodes.value = cached.length
  } else {
    const episodes = [...localEpisodes.value]
    const parseDate = (ep: any) => {
      if (!ep) return 0
      let val = ep.publishedAt ?? ep.pubDate
      if (!val) return 0
      if (typeof val === 'string') {
        const num = Number(val)
        if (!isNaN(num)) val = num
      }
      if (typeof val === 'number') {
        if (val < 1e12) val *= 1000
        return val
      }
      const parsed = Date.parse(val)
      return isNaN(parsed) ? 0 : parsed
    }
    recentEpisodes.value = episodes
      .slice()
      .sort((a, b) => parseDate(b) - parseDate(a))
      .slice(0, 200)
    totalEpisodes.value = recentEpisodes.value.length
  }

  currentPage.value = 0

  if (showToast && !offlineToastShown.value) {
    toast.error(strings.MessageServerConnectionUnavailable)
    offlineToastShown.value = true
  }
}

function libraryChanged(libraryId: string) {
  if (libraryId !== loadedLibraryId.value) {
    if (librariesStore.getCurrentLibraryMediaType === 'podcast') {
      loadRecentEpisodes()
    } else {
      router.replace('/bookshelf')
    }
  }
}

async function loadLocalPodcastLibraryItems() {
  localLibraryItems.value = await db.getLocalLibraryItems('podcast')
}

function newLocalLibraryItem(item: any) {
  if (item.mediaType !== 'podcast') {
    return
  }
  const matchingLocalLibraryItem = localLibraryItems.value.find((lli) => lli.id === item.id)
  if (matchingLocalLibraryItem) {
    matchingLocalLibraryItem.media.episodes = item.media.episodes
  } else {
    localLibraryItems.value.push(item)
  }
}

function scheduleReload(delay = 0) {
  if (reloadTimeout.value) {
    clearTimeout(reloadTimeout.value)
    reloadTimeout.value = null
  }
  reloadTimeout.value = setTimeout(() => {
    reloadTimeout.value = null
    loadRecentEpisodes()
  }, Math.max(delay, 0))
}

onMounted(async () => {
  await loadLocalPodcastLibraryItems()
  loadRecentEpisodes()
  eventBus.on('library-changed', libraryChanged)
  eventBus.on('new-local-library-item', newLocalLibraryItem)
})

onBeforeUnmount(() => {
  if (reloadTimeout.value) {
    clearTimeout(reloadTimeout.value)
    reloadTimeout.value = null
  }
  eventBus.off('library-changed', libraryChanged)
  eventBus.off('new-local-library-item', newLocalLibraryItem)
})
</script>

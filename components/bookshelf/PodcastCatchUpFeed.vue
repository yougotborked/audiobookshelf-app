<template>
  <div class="w-full h-full flex flex-col overflow-hidden">
    <!-- Sticky header -->
    <div class="px-4 pt-4 pb-2 flex items-start justify-between shrink-0">
      <div>
        <h1 class="text-md-title-l text-md-on-surface font-semibold">Catch up</h1>
        <p class="text-md-body-s text-md-on-surface-variant mt-0.5">
          <template v-if="unfinishedEpisodes.length">
            {{ unfinishedEpisodes.length }} episode{{ unfinishedEpisodes.length !== 1 ? 's' : '' }} · oldest first
          </template>
          <template v-else-if="!isLoading">All done</template>
        </p>
      </div>
      <button v-if="unfinishedEpisodes.length" @click="playNext" class="flex items-center gap-1.5 bg-md-primary text-md-on-primary rounded-md-full px-4 py-2 text-md-label-l shrink-0 ml-4 mt-0.5">
        <span class="material-symbols text-base leading-none">play_arrow</span>
        Play next
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <widgets-loading-spinner />
    </div>

    <!-- All caught up -->
    <div v-else-if="!unfinishedEpisodes.length" class="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
      <span class="material-symbols text-5xl text-md-primary">check_circle</span>
      <p class="text-md-title-m text-md-on-surface">All caught up!</p>
      <p class="text-md-body-m text-md-on-surface-variant">New episodes will appear here when they arrive.</p>
    </div>

    <!-- Episode list — reuse LatestEpisodeRow -->
    <div v-else class="flex-1 overflow-y-auto">
      <tables-podcast-latest-episode-row
        v-for="episode in unfinishedEpisodes"
        :key="episode.id"
        :episode="episode"
        :local-episode="localEpisodeMap[episode.id]"
        :library-item-id="episode.libraryItemId"
        :local-library-item-id="localEpisodeMap[episode.id] && localEpisodeMap[episode.id].localLibraryItemId"
        @addToPlaylist="addEpisodeToPlaylist"
      />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    currentLibraryId: {
      type: String,
      default: null
    }
  },
  setup() {
    const appStore = useAppStore()
    const userStore = useUserStore()
    return { appStore, userStore }
  },
  data() {
    return {
      episodes: [],
      isLoading: false,
      localLibraryItems: [],
      offlineToastShown: false
    }
  },
  watch: {
    currentLibraryId(newVal) {
      if (newVal) {
        this.loadEpisodes()
      }
    }
  },
  computed: {
    networkConnected() {
      return this.appStore.networkConnected
    },
    socketConnected() {
      return this.appStore.socketConnected
    },
    serverReachable() {
      return this.appStore.serverReachable
    },
    localEpisodes() {
      const episodes = []
      this.localLibraryItems.forEach((li) => {
        if (li.media.episodes && li.media.episodes.length) {
          li.media.episodes.map((ep) => {
            ep.localLibraryItemId = li.id
            episodes.push(ep)
          })
        }
      })
      return episodes
    },
    localEpisodeMap() {
      var epmap = {}
      this.localEpisodes.forEach((localEp) => {
        if (localEp.serverEpisodeId) {
          epmap[localEp.serverEpisodeId] = localEp
        }
      })
      return epmap
    },
    unfinishedEpisodes() {
      const parseDate = (ep) => {
        let val = ep.publishedAt != null ? ep.publishedAt : ep.pubDate
        if (!val) return 0
        if (typeof val === 'string') {
          const n = Number(val)
          if (!isNaN(n)) val = n
        }
        if (typeof val === 'number') {
          if (val < 1e12) val *= 1000
          return val
        }
        const p = Date.parse(val)
        return isNaN(p) ? 0 : p
      }
      return this.episodes
        .filter((ep) => {
          if (ep.progress?.isFinished) return false
          if (ep.libraryItemId) {
            const storeProgress = this.userStore.getUserMediaProgress(ep.libraryItemId, ep.id)
            if (storeProgress?.isFinished) return false
          }
          return true
        })
        .sort((a, b) => parseDate(a) - parseDate(b))
    }
  },
  methods: {
    async loadLocalPodcastLibraryItems() {
      this.localLibraryItems = await this.$db.getLocalLibraryItems('podcast')
    },
    async useOfflineEpisodes({ showToast = false } = {}) {
      if (!this.localLibraryItems.length) {
        await this.loadLocalPodcastLibraryItems()
      }

      const cached = await this.$localStore.getCachedLatestEpisodes(this.currentLibraryId)
      if (cached.length) {
        this.episodes = cached
      } else {
        const episodes = [...this.localEpisodes]
        const parseDate = (ep) => {
          if (!ep) return 0
          let val = ep.publishedAt != null ? ep.publishedAt : ep.pubDate
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
        this.episodes = episodes
          .slice()
          .sort((a, b) => parseDate(b) - parseDate(a))
          .slice(0, 200)
      }

      if (showToast && !this.offlineToastShown) {
        this.$toast.error(this.$strings.MessageServerConnectionUnavailable)
        this.offlineToastShown = true
      }
    },
    async loadEpisodes() {
      if (!this.currentLibraryId) return

      this.isLoading = true

      const shouldUseOffline = !this.networkConnected || !this.socketConnected || !this.serverReachable

      try {
        if (shouldUseOffline) {
          await this.useOfflineEpisodes({ showToast: this.networkConnected })
          return
        }

        const episodePayload = await this.$nativeHttp.get(`/api/libraries/${this.currentLibraryId}/recent-episodes?limit=200`)

        if (!episodePayload) {
          throw new Error('Empty response payload')
        }

        this.episodes = episodePayload.episodes || []
        this.offlineToastShown = false
        this.$localStore.setCachedLatestEpisodes(this.currentLibraryId, this.episodes)
      } catch (error) {
        console.error('[PodcastCatchUpFeed] Failed to get recent episodes', error)
        await this.useOfflineEpisodes({ showToast: true })
      } finally {
        this.isLoading = false
      }
    },
    async playNext() {
      const episodes = this.unfinishedEpisodes
      if (!episodes.length) return

      await this.$hapticsImpact()

      // Build a queue for all unfinished episodes so playback continues
      // automatically without user interaction — same pattern as playlist "play all".
      const queue = episodes
        .map((ep) => {
          if (!ep.libraryItemId) return null
          const localEp = this.localEpisodeMap[ep.id]
          const localLibraryItemId = localEp?.localLibraryItemId
          return {
            libraryItemId: (localEp && localLibraryItemId) ? localLibraryItemId : ep.libraryItemId,
            episodeId: (localEp && localLibraryItemId) ? localEp.id : ep.id,
            serverLibraryItemId: ep.libraryItemId,
            serverEpisodeId: ep.id,
            episode: ep,
            localEpisode: localEp || null
          }
        })
        .filter(Boolean)

      if (!queue.length) return

      const first = queue[0]

      const firstProgress = first.serverLibraryItemId
        ? this.userStore.getUserMediaProgress(first.serverLibraryItemId, first.serverEpisodeId)
        : null
      const startTime = firstProgress?.currentTime || null

      this.appStore.setPlayQueue(queue)
      this.appStore.setQueueIndex(0)
      this.appStore.playerIsStartingPlayback = true
      this.appStore.playerStartingPlaybackMediaId = first.episodeId

      const playPayload = {
        libraryItemId: first.libraryItemId,
        episodeId: first.episodeId,
        serverLibraryItemId: first.serverLibraryItemId,
        serverEpisodeId: first.serverEpisodeId,
        queue,
        queueIndex: 0
      }
      if (startTime) playPayload.startTime = startTime

      this.$eventBus.$emit('play-item', playPayload)
    },
    async addEpisodeToPlaylist(episode) {
      const libraryItem = await this.$nativeHttp.get(`/api/items/${episode.libraryItemId}`).catch((error) => {
        console.error('[PodcastCatchUpFeed] Failed to get library item', error)
        this.$toast.error('Failed to get library item')
        return null
      })
      if (!libraryItem) return

      this.$store.commit('globals/setSelectedPlaylistItems', [{ libraryItem, episode }])
      this.$store.commit('globals/setShowPlaylistsAddCreateModal', true)
    }
  },
  async mounted() {
    await this.loadLocalPodcastLibraryItems()
    this.loadEpisodes()
  }
}
</script>

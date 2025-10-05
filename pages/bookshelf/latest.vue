<template>
  <div class="w-full p-4">
    <h1 class="text-xl mb-2 font-semibold">{{ $strings.HeaderLatestEpisodes }}</h1>

    <template v-for="episode in recentEpisodes">
      <tables-podcast-latest-episode-row :episode="episode" :local-episode="localEpisodeMap[episode.id]" :library-item-id="episode.libraryItemId" :local-library-item-id="localEpisodeMap[episode.id]?.localLibraryItemId" :key="episode.id" @addToPlaylist="addEpisodeToPlaylist" />
    </template>
  </div>
</template>

<script>
export default {
  data() {
    return {
      processing: false,
      recentEpisodes: [],
      totalEpisodes: 0,
      currentPage: 0,
      localLibraryItems: [],
      loadedLibraryId: null,
      reloadTimeout: null,
      offlineToastShown: false
    }
  },
  watch: {
    networkConnected(newVal) {
      this.scheduleReload(newVal ? 800 : 0)
    },
    socketConnected(newVal) {
      this.scheduleReload(newVal ? 800 : 0)
    },
    serverReachable(newVal) {
      this.scheduleReload(newVal ? 600 : 0)
    }
  },
  computed: {
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    networkConnected() {
      return this.$store.state.networkConnected
    },
    socketConnected() {
      return this.$store.state.socketConnected
    },
    serverReachable() {
      return this.$store.state.serverReachable
    },
    localEpisodes() {
      const episodes = []
      this.localLibraryItems.forEach((li) => {
        if (li.media.episodes?.length) {
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
    }
  },
  methods: {
    async addEpisodeToPlaylist(episode) {
      const libraryItem = await this.$nativeHttp.get(`/api/items/${episode.libraryItemId}`).catch((error) => {
        console.error('Failed to get library item', error)
        this.$toast.error('Failed to get library item')
        return null
      })
      if (!libraryItem) return

      this.$store.commit('globals/setSelectedPlaylistItems', [{ libraryItem, episode }])
      this.$store.commit('globals/setShowPlaylistsAddCreateModal', true)
    },
    async loadRecentEpisodes(page = 0) {
      if (!this.currentLibraryId) return
      this.loadedLibraryId = this.currentLibraryId
      this.processing = true
      const shouldUseOffline = !this.networkConnected || !this.socketConnected || !this.serverReachable

      try {
        if (shouldUseOffline) {
          await this.useOfflineEpisodes({ showToast: this.networkConnected })
          return
        }

        const episodePayload = await this.$nativeHttp.get(
          `/api/libraries/${this.currentLibraryId}/recent-episodes?limit=200&page=${page}`
        )

        if (!episodePayload) {
          throw new Error('Empty response payload')
        }

        console.log('Episodes', episodePayload)
        this.recentEpisodes = episodePayload.episodes || []
        this.totalEpisodes = episodePayload.total ?? this.recentEpisodes.length
        this.currentPage = page
        this.offlineToastShown = false
        this.$localStore.setCachedLatestEpisodes(this.currentLibraryId, this.recentEpisodes)
      } catch (error) {
        console.error('Failed to get recent episodes', error)
        await this.useOfflineEpisodes({ showToast: true })
      } finally {
        this.processing = false
      }
    },
    async useOfflineEpisodes({ showToast = false } = {}) {
      if (!this.localLibraryItems.length) {
        await this.loadLocalPodcastLibraryItems()
      }

      const cached = await this.$localStore.getCachedLatestEpisodes(this.currentLibraryId)
      if (cached.length) {
        this.recentEpisodes = cached
        this.totalEpisodes = cached.length
      } else {
        const episodes = [...this.localEpisodes]
        const parseDate = (ep) => {
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
        this.recentEpisodes = episodes
          .slice()
          .sort((a, b) => parseDate(b) - parseDate(a))
          .slice(0, 200)
        this.totalEpisodes = this.recentEpisodes.length
      }

      this.currentPage = 0

      if (showToast && !this.offlineToastShown) {
        this.$toast.error(this.$strings.MessageServerConnectionUnavailable)
        this.offlineToastShown = true
      }
    },
    libraryChanged(libraryId) {
      if (libraryId !== this.loadedLibraryId) {
        if (this.$store.getters['libraries/getCurrentLibraryMediaType'] === 'podcast') {
          this.loadRecentEpisodes()
        } else {
          this.$router.replace('/bookshelf')
        }
      }
    },
    async loadLocalPodcastLibraryItems() {
      this.localLibraryItems = await this.$db.getLocalLibraryItems('podcast')
    },
    newLocalLibraryItem(item) {
      if (item.mediaType !== 'podcast') {
        return
      }
      const matchingLocalLibraryItem = this.localLibraryItems.find((lli) => lli.id === item.id)
      if (matchingLocalLibraryItem) {
        matchingLocalLibraryItem.media.episodes = item.media.episodes
      } else {
        this.localLibraryItems.push(item)
      }
    },
    scheduleReload(delay = 0) {
      if (this.reloadTimeout) {
        clearTimeout(this.reloadTimeout)
        this.reloadTimeout = null
      }
      this.reloadTimeout = setTimeout(() => {
        this.reloadTimeout = null
        this.loadRecentEpisodes()
      }, Math.max(delay, 0))
    }
  },
  async mounted() {
    await this.loadLocalPodcastLibraryItems()
    this.loadRecentEpisodes()
    this.$eventBus.$on('library-changed', this.libraryChanged)
    this.$eventBus.$on('new-local-library-item', this.newLocalLibraryItem)
  },
  beforeDestroy() {
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout)
      this.reloadTimeout = null
    }
    this.$eventBus.$off('library-changed', this.libraryChanged)
    this.$eventBus.$off('new-local-library-item', this.newLocalLibraryItem)
  }
}
</script>

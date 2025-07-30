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
      loadedLibraryId: null
    }
  },
  watch: {
    networkConnected(newVal) {
      if (newVal && !this.recentEpisodes.length) {
        setTimeout(() => this.loadRecentEpisodes(), 1000)
      }
    }
  },
  computed: {
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    networkConnected() {
      return this.$store.state.networkConnected
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
      this.loadedLibraryId = this.currentLibraryId
      this.processing = true
      if (!this.networkConnected) {
        const cached = await this.$localStore.getCachedLatestEpisodes(this.currentLibraryId)
        this.recentEpisodes = cached
        this.totalEpisodes = cached.length
        this.processing = false
        return
      }
      const episodePayload = await this.$nativeHttp.get(`/api/libraries/${this.currentLibraryId}/recent-episodes?limit=200&page=${page}`).catch((error) => {
        console.error('Failed to get recent episodes', error)
        this.$toast.error('Failed to get recent episodes')
        return null
      })
      this.processing = false
      console.log('Episodes', episodePayload)
      this.recentEpisodes = episodePayload.episodes || []
      this.totalEpisodes = episodePayload.total
      this.currentPage = page
      this.$localStore.setCachedLatestEpisodes(this.currentLibraryId, this.recentEpisodes)
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
    }
  },
  mounted() {
    this.loadRecentEpisodes()
    this.loadLocalPodcastLibraryItems()
    this.$eventBus.$on('library-changed', this.libraryChanged)
    this.$eventBus.$on('new-local-library-item', this.newLocalLibraryItem)
  },
  beforeDestroy() {
    this.$eventBus.$off('library-changed', this.libraryChanged)
    this.$eventBus.$off('new-local-library-item', this.newLocalLibraryItem)
  }
}
</script>

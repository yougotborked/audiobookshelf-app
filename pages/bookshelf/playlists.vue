<template>
  <div class="w-full h-full overflow-y-auto">
    <div
      v-if="autoCacheUnplayedEpisodes"
      class="px-4 pt-4"
    >
      <div class="mb-4 border border-fg/20 rounded p-4 flex items-center">
        <nuxt-link to="/playlist/unfinished" class="flex items-center flex-grow">
          <covers-playlist-cover :items="autoPlaylist.items" :width="64" :height="64" />
          <p class="text-lg ml-4">{{ autoPlaylist.name }}</p>
        </nuxt-link>
      </div>
    </div>
    <bookshelf-lazy-bookshelf page="playlists" />
  </div>
</template>

<script>
import { AbsDownloader } from '@/plugins/capacitor'
import { buildUnfinishedAutoPlaylist, collectDownloadedEpisodeKeys } from '@/mixins/autoPlaylistHelpers'
export default {
  async asyncData({ store, app }) {
    const name = app.$strings.LabelAutoUnfinishedPodcasts
    const enabled = store.state.deviceData?.deviceSettings?.autoCacheUnplayedEpisodes
    if (!enabled)
      return { autoPlaylist: { id: 'unfinished', name, items: [] } }
    const cached = await app.$localStore.getCachedPlaylist('unfinished')
    if (cached) return { autoPlaylist: cached }
    return { autoPlaylist: { id: 'unfinished', name, items: [] } }
  },
  data() {
    return {
      autoPlaylist: { name: '', items: [] },
      downloadedEpisodeKeys: null
    }
  },
  mounted() {
    if (this.autoCacheUnplayedEpisodes) this.fetchAutoPlaylist()
  },
  watch: {
    networkConnected(newVal) {
      if (newVal && this.autoCacheUnplayedEpisodes) {
        if (!this.autoPlaylist.items.length) {
          setTimeout(() => {
            this.fetchAutoPlaylist()
          }, 1000)
        } else {
          this.checkAutoDownload()
        }
      }
    },
    autoCacheUnplayedEpisodes(newVal) {
      if (newVal && !this.autoPlaylist.items.length) {
        this.fetchAutoPlaylist()
      }
    }
  },
  computed: {
    networkConnected() {
      return this.$store.state.networkConnected
    },
    autoCacheUnplayedEpisodes() {
      return this.$store.state.deviceData?.deviceSettings?.autoCacheUnplayedEpisodes
    }
  },
  methods: {
    async fetchAutoPlaylist() {
      try {
        const { items, downloadedEpisodeKeys } = await buildUnfinishedAutoPlaylist({
          store: this.$store,
          db: this.$db,
          localStore: this.$localStore,
          nativeHttp: this.$nativeHttp,
          networkConnected: this.networkConnected
        })

        this.downloadedEpisodeKeys = downloadedEpisodeKeys

        this.autoPlaylist = {
          id: 'unfinished',
          name: this.$strings.LabelAutoUnfinishedPodcasts,
          items
        }

        await this.$localStore.setCachedPlaylist(this.autoPlaylist)
        this.checkAutoDownload()
      } catch (error) {
        console.error('Failed to fetch auto playlist', error)
      }
    },
    async ensureDownloadedKeySet() {
      if (this.downloadedEpisodeKeys instanceof Set) {
        return this.downloadedEpisodeKeys
      }

      const localLibraries = await this.$db.getLocalLibraryItems('podcast')
      this.downloadedEpisodeKeys = collectDownloadedEpisodeKeys(localLibraries)
      return this.downloadedEpisodeKeys
    },
    async checkAutoDownload() {
      if (!this.networkConnected) return
      if (!this.$store.state.deviceData?.deviceSettings?.autoCacheUnplayedEpisodes) return

      const downloadedKeys = await this.ensureDownloadedKeySet()

      for (const qi of this.autoPlaylist.items) {
        const liId = qi.libraryItemId || qi.libraryItem?.libraryItemId || qi.libraryItem?.id
        const epId = qi.episodeId || qi.episode?.serverEpisodeId || qi.episode?.id
        if (!liId || !epId) continue

        const key = `${liId}_${epId}`
        if (downloadedKeys.has(key)) continue

        AbsDownloader.downloadLibraryItem({ libraryItemId: liId, episodeId: epId })
        downloadedKeys.add(key)
      }
    }
  }
}
</script>

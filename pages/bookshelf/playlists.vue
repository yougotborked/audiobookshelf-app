<template>
  <div class="w-full h-full overflow-y-auto">
    <div class="px-4 pt-4">
      <nuxt-link to="/playlist/unfinished" class="block mb-4 border border-fg/20 rounded p-4 flex items-center">
        <covers-playlist-cover :items="autoPlaylist.items" :width="64" :height="64" />
        <p class="text-lg ml-4">{{ autoPlaylist.name }}</p>
      </nuxt-link>
    </div>
    <bookshelf-lazy-bookshelf page="playlists" />
  </div>
</template>

<script>
import { AbsDownloader } from '@/plugins/capacitor'
export default {
  async asyncData({ store, app }) {
    const cached = await app.$localStore.getCachedPlaylist('unfinished')
    const name = app.$strings.LabelAutoUnfinishedPodcasts
    if (cached) return { autoPlaylist: cached }
    return { autoPlaylist: { id: 'unfinished', name, items: [] } }
  },
  data() {
    return {
      autoPlaylist: { name: '', items: [] }
    }
  },
  mounted() {
    this.fetchAutoPlaylist()
  },
  watch: {
    networkConnected(newVal) {
      if (newVal && !this.autoPlaylist.items.length) {
        setTimeout(() => {
          this.fetchAutoPlaylist()
        }, 1000)
      }
    }
  },
  computed: {
    networkConnected() {
      return this.$store.state.networkConnected
    }
  },
  methods: {
    async fetchAutoPlaylist() {
      if (!this.$store.state.networkConnected) {
        this.checkAutoDownload()
        return
      }

      const progressMap = {}
      ;(this.$store.state.user.user?.mediaProgress || []).forEach((mp) => {
        if (mp.episodeId) progressMap[mp.episodeId] = mp
      })
      const items = []
      const libraries = this.$store.state.libraries.libraries.filter((l) => l.mediaType === 'podcast')
      for (const lib of libraries) {
        const payload = await this.$nativeHttp.get(`/api/libraries/${lib.id}/recent-episodes?limit=50`).catch(() => null)
        const episodes = payload?.episodes || []
        for (const ep of episodes) {
          const prog = progressMap[ep.id]
          if (prog && prog.isFinished) continue
          const li = await this.$nativeHttp.get(`/api/items/${ep.libraryItemId}`).catch(() => null)
          if (!li) continue
          items.push({ libraryItem: li, episode: ep })
        }
      }
      items.sort((a, b) => new Date(b.episode.pubDate || 0) - new Date(a.episode.pubDate || 0))
      this.autoPlaylist = { id: 'unfinished', name: this.$strings.LabelAutoUnfinishedPodcasts, items }
      await this.$localStore.setCachedPlaylist(this.autoPlaylist)
      this.checkAutoDownload()
    },
    async checkAutoDownload() {
      if (!this.$store.state.deviceData?.deviceSettings?.autoCacheUnplayedEpisodes) return
      const localItems = await this.$db.getLocalLibraryItems('podcast')
      for (const qi of this.autoPlaylist.items) {
        const liId = qi.libraryItem.id
        const epId = qi.episode.id
        const localLi = localItems.find((lli) => lli.libraryItemId === liId)
        const localEp = localLi?.media?.episodes?.find((ep) => ep.serverEpisodeId === epId)
        if (!localEp) {
          AbsDownloader.downloadLibraryItem({ libraryItemId: liId, episodeId: epId })
        }
      }
    }
  }
}
</script>

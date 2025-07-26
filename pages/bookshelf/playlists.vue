<template>
  <div class="w-full h-full overflow-y-auto">
    <div class="px-4 pt-4">
      <div class="mb-4 border border-fg/20 rounded p-4 flex items-center">
        <nuxt-link to="/playlist/unfinished" class="flex items-center flex-grow">
          <covers-playlist-cover :items="autoPlaylist.items" :width="64" :height="64" />
          <p class="text-lg ml-4">{{ autoPlaylist.name }}</p>
        </nuxt-link>
        <ui-btn
          v-if="showAutoPlayButton"
          color="success"
          :padding-x="4"
          small
          class="flex items-center justify-center ml-2 w-24"
          @click="playAutoPlaylist"
        >
          <span class="material-symbols text-2xl fill">play_arrow</span>
          <span class="px-1 text-sm">{{ $strings.ButtonPlayAll }}</span>
        </ui-btn>
      </div>
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
    },
    showAutoPlayButton() {
      return this.autoPlaylist.items.length
    }
  },
  methods: {
    playAutoPlaylist() {
      if (!this.autoPlaylist.items.length) return
      const nextItem = this.autoPlaylist.items.find((i) => {
        const prog = this.$store.getters['user/getUserMediaProgress'](
          i.libraryItemId,
          i.episodeId
        )
        return !prog?.isFinished
      }) || this.autoPlaylist.items[0]

      const index = this.autoPlaylist.items.findIndex((i) => i === nextItem)
      const mediaId = nextItem.episodeId || nextItem.libraryItemId
      this.$store.commit('setPlayerIsStartingPlayback', mediaId)
      this.$store.commit('setPlayQueue', this.autoPlaylist.items)
      this.$store.commit('setQueueIndex', index)
      const payload = {
        libraryItemId: nextItem.localLibraryItem?.id || nextItem.libraryItemId,
        episodeId: nextItem.localEpisode?.id || nextItem.episodeId,
        serverLibraryItemId: nextItem.libraryItemId,
        serverEpisodeId: nextItem.episodeId,
        queue: this.autoPlaylist.items,
        queueIndex: index
      }
      this.$eventBus.$emit('play-item', payload)
    },
    async fetchAutoPlaylist() {
      const progressMap = {}
      ;(this.$store.state.user.user?.mediaProgress || []).forEach((mp) => {
        if (mp.episodeId) progressMap[mp.episodeId] = mp
      })

      const items = []
      const localLibraries = await this.$db.getLocalLibraryItems('podcast')
      for (const li of localLibraries) {
        const episodes = li.media?.episodes || []
        for (const ep of episodes) {
          const serverId = ep.serverEpisodeId
          if (!serverId) continue
          const prog = progressMap[serverId]
          if (prog && prog.isFinished) continue
          items.push({
            libraryItem: li,
            episode: ep,
            libraryItemId: li.libraryItemId,
            episodeId: serverId,
            localLibraryItem: li,
            localEpisode: ep
          })
        }
      }

      const parseDate = (ep) => {
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
      items.sort((a, b) => parseDate(a.episode) - parseDate(b.episode))

      this.autoPlaylist = {
        id: 'unfinished',
        name: this.$strings.LabelAutoUnfinishedPodcasts,
        items
      }
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

<template>
  <div class="w-full h-full overflow-y-auto">
    <div class="px-4 pt-4">
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
      if (newVal) {
        if (!this.autoPlaylist.items.length) {
          setTimeout(() => {
            this.fetchAutoPlaylist()
          }, 1000)
        } else {
          this.checkAutoDownload()
        }
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
      const progressMap = {}
      ;(this.$store.state.user.user?.mediaProgress || []).forEach((mp) => {
        if (mp.episodeId) progressMap[mp.episodeId] = mp
      })

      const items = []
      const seen = new Set()
      const localLibraries = await this.$db.getLocalLibraryItems('podcast')
      for (const li of localLibraries) {
        let episodes = li.media?.episodes || []

        const cachedMeta = (await this.$localStore.getEpisodeMetadata(
          li.libraryItemId
        )) || []
        const metaMap = {}
        cachedMeta.forEach((m) => {
          if (m && m.id) metaMap[m.id] = m
        })
        episodes = episodes.map((ep) => {
          const id = ep.serverEpisodeId || ep.id
          if (id && (!ep.publishedAt && !ep.pubDate) && metaMap[id]) {
            return {
              ...ep,
              publishedAt: metaMap[id].publishedAt,
              pubDate: metaMap[id].pubDate
            }
          }
          return ep
        })

        let missingDates = episodes.some((e) => !e.publishedAt && !e.pubDate)
        if (this.networkConnected && missingDates) {
          const serverItem = await this.$nativeHttp
            .get(`/api/items/${li.libraryItemId}?expanded=1`)
            .catch(() => null)
          if (serverItem?.media?.episodes?.length) {
            episodes = serverItem.media.episodes.map((se) => {
              const localEp = li.media?.episodes?.find(
                (lep) => lep.serverEpisodeId === se.id
              )
              return localEp ? { ...se, localEpisode: localEp } : se
            })
            const meta = serverItem.media.episodes.map((se) => ({
              id: se.id,
              pubDate: se.pubDate,
              publishedAt: se.publishedAt
            }))
            await this.$localStore.setEpisodeMetadata(li.libraryItemId, meta)
          }
        }

        for (const ep of episodes) {
          const serverId = ep.serverEpisodeId || ep.id
          if (!serverId) continue
          const prog = progressMap[serverId]
          if (prog && prog.isFinished) continue
          const key = `${li.libraryItemId}_${serverId}`
          if (seen.has(key)) continue
          seen.add(key)
          items.push({
            libraryItem: li,
            episode: ep,
            libraryItemId: li.libraryItemId,
            episodeId: serverId,
            localLibraryItem: li,
            localEpisode: ep.localEpisode || ep
          })
        }
      }

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
      if (!this.networkConnected) return
      if (!this.$store.state.deviceData?.deviceSettings?.autoCacheUnplayedEpisodes) return
      const localItems = await this.$db.getLocalLibraryItems('podcast')
      for (const qi of this.autoPlaylist.items) {
        const liId = qi.libraryItemId || qi.libraryItem?.libraryItemId || qi.libraryItem?.id
        const epId = qi.episodeId || qi.episode?.serverEpisodeId || qi.episode?.id
        const localLi = localItems.find((lli) => lli.libraryItemId === liId)
        const localEp = localLi?.media?.episodes?.find((ep) => ep.serverEpisodeId === epId)
        if (!localEp && liId && epId) {
          AbsDownloader.downloadLibraryItem({ libraryItemId: liId, episodeId: epId })
        }
      }
    }
  }
}
</script>

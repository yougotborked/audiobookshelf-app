<template>
  <div class="w-full h-full">
    <div class="w-full h-full overflow-y-auto py-6 md:p-8">
      <div class="w-full flex justify-center">
        <covers-playlist-cover :items="playlistItems" :width="180" :height="180" />
      </div>
      <div class="flex-grow px-1 py-6">
        <div class="flex items-center px-3">
          <h1 class="text-xl font-sans">
            {{ playlistName }}
          </h1>
          <div class="flex-grow" />
          <ui-btn
            v-if="showPlayButton"
            color="success"
            :padding-x="4"
            :loading="playerIsStartingForThisMedia"
            small
            class="flex items-center justify-center mx-1 w-24"
            @click.stop="playClick"
          >
            <span class="material-symbols text-2xl fill">{{ playerIsPlaying ? 'pause' : 'play_arrow' }}</span>
            <span class="px-1 text-sm">{{ playerIsPlaying ? $strings.ButtonPause : $strings.ButtonPlay }}</span>
          </ui-btn>
        </div>

        <div class="my-8 max-w-2xl px-3">
          <p class="text-base text-fg">{{ description }}</p>
        </div>

        <tables-playlist-items-table :items="playlistItems" :playlist-id="playlist.id" @showMore="showMore" />
      </div>
    </div>

    <modals-item-more-menu-modal v-model="showMoreMenu" :library-item="selectedLibraryItem" :episode="selectedEpisode" :playlist="playlist" hide-rss-feed-option :processing.sync="processing" />
    <div v-show="processing" class="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-black/50 z-50">
      <ui-loading-indicator />
    </div>
  </div>
</template>

<script>
import { AbsDownloader } from '@/plugins/capacitor'
export default {
  async asyncData({ store, params, app, redirect, route }) {
    const user = store.state.user.user
    const serverConfig = store.state.user.serverConnectionConfig
    const networkConnected = store.state.networkConnected
    if (!user && !serverConfig && networkConnected) {
      return redirect(`/connect?redirect=${route.path}`)
    }

    const cached = await app.$localStore.getCachedPlaylist(params.id)
    const playlist = cached || { id: params.id, name: '', description: '', items: [] }
    return { playlist }
  },
  data() {
    return {
      showMoreMenu: false,
      processing: false,
      selectedLibraryItem: null,
      selectedEpisode: null,
      mediaIdStartingPlayback: null
    }
  },
  watch: {
    networkConnected(newVal) {
      if (!newVal) return

      const isUnfinished = this.$route.params.id === 'unfinished'
      if (!this.playlist.items.length) {
        if (!isUnfinished || this.autoCacheUnplayedEpisodes) {
          setTimeout(() => {
            this.fetchPlaylist()
          }, 1000)
        }
        return
      }

      this.checkAutoDownload()
    },
    autoCacheUnplayedEpisodes(newVal) {
      if (
        newVal &&
        this.$route.params.id === 'unfinished' &&
        !this.playlist.items.length
      ) {
        this.fetchPlaylist()
      }
    }
  },
  computed: {
    networkConnected() {
      return this.$store.state.networkConnected
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    playlistItems() {
      return this.playlist.items || []
    },
    playlistName() {
      return this.playlist.name || ''
    },
    description() {
      return this.playlist.description || ''
    },
    playableItems() {
      return this.playlistItems.filter((item) => {
        const libraryItem = item.libraryItem
        if (libraryItem.isMissing || libraryItem.isInvalid) return false
        if (item.episode) return true
        return libraryItem.media.tracks.length
      })
    },
    playerIsPlaying() {
      return this.$store.state.playerIsPlaying && this.isOpenInPlayer
    },
    isOpenInPlayer() {
      return !!this.playableItems.find((i) => {
        if (i.localLibraryItem && this.$store.getters['getIsMediaStreaming'](i.localLibraryItem.id, i.localEpisode?.id)) return true
        return this.$store.getters['getIsMediaStreaming'](i.libraryItemId, i.episodeId)
      })
    },
    autoContinuePlaylists() {
      return this.$store.state.deviceData?.deviceSettings?.autoContinuePlaylists
    },
    showPlayButton() {
      return this.playableItems.length
    },
    playerIsStartingPlayback() {
      // Play has been pressed and waiting for native play response
      return this.$store.state.playerIsStartingPlayback
    },
    playerIsStartingForThisMedia() {
      if (!this.mediaIdStartingPlayback) return false
      const mediaId = this.$store.state.playerStartingPlaybackMediaId
      return mediaId === this.mediaIdStartingPlayback
    },
    autoCacheUnplayedEpisodes() {
      return this.$store.state.deviceData?.deviceSettings?.autoCacheUnplayedEpisodes
    }
  },
  methods: {
    async fetchPlaylist() {
      const id = this.$route.params.id
      let playlist
      if (id === 'unfinished') {
        if (!this.autoCacheUnplayedEpisodes) {
          playlist = {
            id: 'unfinished',
            name: this.$strings.LabelAutoUnfinishedPodcasts,
            description: '',
            items: []
          }
        } else {
          const progressMap = {}
          ;(this.$store.state.user.user?.mediaProgress || []).forEach((mp) => {
            if (mp.episodeId) progressMap[mp.episodeId] = mp
          })
          ;(this.$store.state.globals.localMediaProgress || []).forEach((mp) => {
            if (mp.episodeId) progressMap[mp.episodeId] = mp
          })

          const items = []
          const seen = new Set()
          const localLibraries = await this.$db.getLocalLibraryItems('podcast')
          for (const li of localLibraries) {
            let episodes = li.media?.episodes || []

            const cachedMeta =
              (await this.$localStore.getEpisodeMetadata(li.libraryItemId)) || []
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
            if (this.$store.state.networkConnected && missingDates) {
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
                await this.$localStore.setEpisodeMetadata(
                  li.libraryItemId,
                  meta
                )
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
              const serverLibraryItem = { ...li, id: li.libraryItemId }
              items.push({
                libraryItem: serverLibraryItem,
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

          playlist = {
            id: 'unfinished',
            name: this.$strings.LabelAutoUnfinishedPodcasts,
            description: '',
            items
          }
        }
      } else {
        if (!this.$store.state.networkConnected) {
          this.checkAutoDownload()
          return
        }
        playlist = await this.$nativeHttp.get(`/api/playlists/${id}`).catch(() => null)
        if (!playlist) return
      }

      if (playlist.items.length) {
        const localLibraryItems = (await this.$db.getLocalLibraryItems(playlist.items[0].libraryItem.mediaType)) || []
        if (localLibraryItems.length) {
          playlist.items.forEach((playlistItem) => {
            const matchingLocalLibraryItem = localLibraryItems.find((lli) => lli.libraryItemId === playlistItem.libraryItemId)
            if (!matchingLocalLibraryItem) return
            if (playlistItem.episode) {
              const matchingLocalEpisode = matchingLocalLibraryItem.media.episodes?.find((lep) => lep.serverEpisodeId === playlistItem.episodeId)
              if (matchingLocalEpisode) {
                playlistItem.localLibraryItem = matchingLocalLibraryItem
                playlistItem.localEpisode = matchingLocalEpisode
              }
            } else {
              playlistItem.localLibraryItem = matchingLocalLibraryItem
            }
          })
        }
      }
      await this.$localStore.setCachedPlaylist(playlist)
      this.playlist = playlist
      this.checkAutoDownload()
    },
    showMore(playlistItem) {
      this.selectedLibraryItem = playlistItem.libraryItem
      this.selectedEpisode = playlistItem.episode
      this.showMoreMenu = true
    },
    async playClick() {
      if (this.playerIsStartingPlayback) return
      await this.$hapticsImpact()

      if (this.playerIsPlaying && this.isOpenInPlayer) {
        this.$eventBus.$emit('pause-item')
      } else {
        this.playAll()
      }
    },
    playAll() {
      if (!this.playableItems.length) return
      const nextItem = this.playableItems[0]
      this.mediaIdStartingPlayback = nextItem.episodeId || nextItem.libraryItemId
      this.$store.commit('setPlayerIsStartingPlayback', this.mediaIdStartingPlayback)
      this.$store.commit('setPlayQueue', this.playableItems)
      this.$store.commit('setQueueIndex', 0)
      const payload = {
        libraryItemId: nextItem.localLibraryItem?.id || nextItem.libraryItemId,
        episodeId: nextItem.localEpisode?.id || nextItem.episodeId,
        serverLibraryItemId: nextItem.libraryItemId,
        serverEpisodeId: nextItem.episodeId,
        queue: this.playableItems,
        queueIndex: 0
      }
      this.$eventBus.$emit('play-item', payload)
    },
    playNextItem() {
      const nowIndex = this.playableItems.findIndex((i) => {
        return this.$store.getters['getIsMediaStreaming'](
          i.localLibraryItem?.id || i.libraryItemId,
          i.localEpisode?.id || i.episodeId
        )
      })

      const nextItem = this.playableItems.slice(nowIndex + 1).find((i) => {
        const prog = this.$store.getters['user/getUserMediaProgress'](i.libraryItemId, i.episodeId)
        return !prog?.isFinished
      })

      if (nextItem) {
        const nextIndex = this.playableItems.findIndex((i) => i === nextItem)
        this.mediaIdStartingPlayback = nextItem.episodeId || nextItem.libraryItemId
        this.$store.commit('setPlayerIsStartingPlayback', this.mediaIdStartingPlayback)
        this.$store.commit('setPlayQueue', this.playableItems)
        this.$store.commit('setQueueIndex', nextIndex)
        const payload = {
          libraryItemId: nextItem.localLibraryItem?.id || nextItem.libraryItemId,
          episodeId: nextItem.localEpisode?.id || nextItem.episodeId,
          serverLibraryItemId: nextItem.libraryItemId,
          serverEpisodeId: nextItem.episodeId,
          queue: this.playableItems,
          queueIndex: nextIndex
        }
        this.$eventBus.$emit('play-item', payload)
      }
    },
    onPlaybackEnded() {
      this.playNextItem()
    },
    playlistUpdated(playlist) {
      if (this.playlist.id !== playlist.id) return
      this.playlist = playlist
      this.$localStore.setCachedPlaylist(playlist)
    },
    playlistRemoved(playlist) {
      if (this.playlist.id === playlist.id) {
        this.$localStore.removeCachedPlaylist(playlist.id)
        this.$router.replace('/bookshelf/playlists')
      }
    },
    async checkAutoDownload() {
      if (!this.networkConnected) return
      if (!this.$store.state.deviceData?.deviceSettings?.autoCacheUnplayedEpisodes) return
      const localItems = await this.$db.getLocalLibraryItems('podcast')
      for (const qi of this.playlist.items) {
        const liId = qi.libraryItemId || qi.libraryItem?.libraryItemId || qi.libraryItem?.id
        const epId = qi.episodeId || qi.episode?.serverEpisodeId || qi.episode?.id
        const localLi = localItems.find((lli) => lli.libraryItemId === liId)
        const localEp = localLi?.media?.episodes?.find((ep) => ep.serverEpisodeId === epId)
        if (!localEp && liId && epId) {
          AbsDownloader.downloadLibraryItem({ libraryItemId: liId, episodeId: epId })
        }
      }
    }
  },
  mounted() {
    this.$socket.$on('playlist_updated', this.playlistUpdated)
    this.$socket.$on('playlist_removed', this.playlistRemoved)
    this.$eventBus.$on('playback-ended', this.onPlaybackEnded)
    this.fetchPlaylist()
  },
  beforeDestroy() {
    this.$socket.$off('playlist_updated', this.playlistUpdated)
    this.$socket.$off('playlist_removed', this.playlistRemoved)
    this.$eventBus.$off('playback-ended', this.onPlaybackEnded)
  }
}
</script>

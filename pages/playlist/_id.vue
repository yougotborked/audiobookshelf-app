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
          <ui-btn v-if="showPlayButton" color="success" :padding-x="4" :loading="playerIsStartingForThisMedia" small class="flex items-center justify-center mx-1 w-24" @click="playClick">
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
    if (!store.state.user.user) {
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
      if (newVal && !this.playlist.items.length) {
        setTimeout(() => {
          this.fetchPlaylist()
        }, 1000)
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
        if (item.episode) return item.episode.audioFile
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
    }
  },
  methods: {
    async fetchPlaylist() {
      if (!this.$store.state.networkConnected) {
        this.checkAutoDownload()
        return
      }
      const id = this.$route.params.id
      let playlist
      if (id === 'unfinished') {
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
            items.push({ libraryItem: li, episode: ep, libraryItemId: ep.libraryItemId, episodeId: ep.id })
          }
        }
        items.sort((a, b) => new Date(b.episode.pubDate || 0) - new Date(a.episode.pubDate || 0))
        playlist = { id: 'unfinished', name: this.$strings.LabelAutoUnfinishedPodcasts, description: '', items }
      } else {
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

      if (this.playerIsPlaying) {
        this.$eventBus.$emit('pause-item')
      } else {
        this.playNextItem()
      }
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
      if (!this.$store.state.deviceData?.deviceSettings?.autoCacheUnplayedEpisodes) return
      const localItems = await this.$db.getLocalLibraryItems('podcast')
      for (const qi of this.playlist.items) {
        const liId = qi.libraryItem.id
        const epId = qi.episode.id
        const localLi = localItems.find((lli) => lli.libraryItemId === liId)
        const localEp = localLi?.media?.episodes?.find((ep) => ep.serverEpisodeId === epId)
        if (!localEp) {
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

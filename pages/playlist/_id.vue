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
import { buildUnfinishedAutoPlaylist, collectDownloadedEpisodeKeys } from '@/mixins/autoPlaylistHelpers'
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
      mediaIdStartingPlayback: null,
      downloadedEpisodeKeys: null
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
          const { items, downloadedEpisodeKeys } = await buildUnfinishedAutoPlaylist({
            store: this.$store,
            db: this.$db,
            localStore: this.$localStore,
            nativeHttp: this.$nativeHttp,
            networkConnected: this.networkConnected
          })

          playlist = {
            id: 'unfinished',
            name: this.$strings.LabelAutoUnfinishedPodcasts,
            description: '',
            items
          }

          this.downloadedEpisodeKeys = downloadedEpisodeKeys
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
        const mediaType = playlist.items[0]?.libraryItem?.mediaType
        const localLibraryItems = mediaType ? (await this.$db.getLocalLibraryItems(mediaType)) || [] : []
        if (localLibraryItems.length) {
          const localLibraryItemMap = new Map()
          const episodeMapsByLocalId = new Map()

          localLibraryItems.forEach((localItem) => {
            if (localItem?.libraryItemId) {
              localLibraryItemMap.set(localItem.libraryItemId, localItem)
            }
          })

          const getEpisodeMap = (localItem) => {
            if (!localItem?.id) return null
            if (episodeMapsByLocalId.has(localItem.id)) {
              return episodeMapsByLocalId.get(localItem.id)
            }

            const map = new Map()
            ;(localItem.media?.episodes || []).forEach((episode) => {
              const serverEpisodeId = episode?.serverEpisodeId || episode?.id
              if (serverEpisodeId) {
                map.set(serverEpisodeId, episode)
              }
            })

            episodeMapsByLocalId.set(localItem.id, map)
            return map
          }

          playlist.items.forEach((playlistItem) => {
            const matchingLocalLibraryItem = localLibraryItemMap.get(playlistItem.libraryItemId)
            if (!matchingLocalLibraryItem) return

            playlistItem.localLibraryItem = matchingLocalLibraryItem

            if (!playlistItem.episode && !playlistItem.episodeId) return

            const episodeMap = getEpisodeMap(matchingLocalLibraryItem)
            if (!episodeMap) return

            const episodeKey =
              playlistItem.episodeId ||
              playlistItem.episode?.serverEpisodeId ||
              playlistItem.episode?.id

            if (!episodeKey) return

            const matchingLocalEpisode = episodeMap.get(episodeKey)
            if (matchingLocalEpisode) {
              playlistItem.localEpisode = matchingLocalEpisode
            }
          })
        }

        if (!this.downloadedEpisodeKeys) {
          this.downloadedEpisodeKeys = collectDownloadedEpisodeKeys(localLibraryItems)
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
    async ensureDownloadedKeySet(mediaType = 'podcast') {
      if (this.downloadedEpisodeKeys instanceof Set) {
        return this.downloadedEpisodeKeys
      }

      const localLibraries = await this.$db.getLocalLibraryItems(mediaType)
      this.downloadedEpisodeKeys = collectDownloadedEpisodeKeys(localLibraries)
      return this.downloadedEpisodeKeys
    },
    async checkAutoDownload() {
      if (!this.networkConnected) return
      if (!this.$store.state.deviceData?.deviceSettings?.autoCacheUnplayedEpisodes) return

      const mediaType = this.playlist.items[0]?.libraryItem?.mediaType || 'podcast'
      const downloadedKeys = await this.ensureDownloadedKeySet(mediaType)

      for (const qi of this.playlist.items) {
        const liId = qi.libraryItemId || qi.libraryItem?.libraryItemId || qi.libraryItem?.id
        const epId = qi.episodeId || qi.episode?.serverEpisodeId || qi.episode?.id
        if (!liId || !epId) continue

        const key = `${liId}_${epId}`
        if (downloadedKeys.has(key)) continue

        AbsDownloader.downloadLibraryItem({ libraryItemId: liId, episodeId: epId })
        downloadedKeys.add(key)
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

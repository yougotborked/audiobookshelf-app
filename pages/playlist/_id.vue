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

        <tables-playlist-items-table
          :items="playlistItems"
          :total-items="playlistTotalItems"
          :playlist-id="playlist.id"
          @showMore="showMore"
        />
      </div>
    </div>

    <modals-item-more-menu-modal
      v-model="showMoreMenu"
      :library-item="selectedLibraryItem"
      :episode="selectedEpisode"
      :playlist="playlist"
      hide-rss-feed-option
      :processing.sync="processing"
      @removed-from-auto-playlist="onAutoPlaylistItemRemoved"
    />
    <div v-show="processing" class="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-black/50 z-50">
      <ui-loading-indicator />
    </div>
  </div>
</template>

<script>
import { AbsDownloader, AbsLogger } from '@/plugins/capacitor'
import {
  buildUnfinishedAutoPlaylist,
  collectDownloadedEpisodeKeys,
  toCacheablePlaylist
} from '@/mixins/autoPlaylistHelpers'
const MAX_QUEUE_ITEMS = 400
const MAX_LOG_LENGTH = 2000

function formatForLog(payload) {
  try {
    const json = JSON.stringify(payload)
    if (json.length > MAX_LOG_LENGTH) {
      return `${json.substring(0, MAX_LOG_LENGTH)}... (truncated)`
    }
    return json
  } catch (error) {
    return '[unserializable payload]'
  }
}

export default {
  async asyncData({ store, params, app, redirect, route }) {
    const user = store.state.user.user
    const serverConfig = store.state.user.serverConnectionConfig
    const networkConnected = store.state.networkConnected
    if (!user && !serverConfig && networkConnected) {
      return redirect(`/connect?redirect=${route.path}`)
    }

    const cached = await app.$localStore.getCachedPlaylist(params.id)
    const playlist = cached
      ? {
          ...cached,
          totalItems: cached.totalItems || (cached.items ? cached.items.length : 0)
        }
      : { id: params.id, name: '', description: '', items: [], totalItems: 0 }
    return { playlist }
  },
  data() {
    return {
      showMoreMenu: false,
      processing: false,
      selectedLibraryItem: null,
      selectedLibraryItemId: null,
      selectedEpisode: null,
      selectedEpisodeId: null,
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
    playlistTotalItems() {
      return this.playlist.totalItems || this.playlistItems.length
    },
    playlistName() {
      return this.playlist.name || ''
    },
    description() {
      return this.playlist.description || ''
    },
    playableItems() {
      return this.playlistItems.filter((item) => {
        const libraryItem = item.libraryItem || item.localLibraryItem
        if (!libraryItem) return false

        const hasLocalFallback = !!(item.localLibraryItem || item.localEpisode)
        if (libraryItem.isMissing || libraryItem.isInvalid) {
          if (!hasLocalFallback) return false
        }

        if (item.episode || item.localEpisode) return true

        const tracks = item.localLibraryItem?.media?.tracks || libraryItem.media?.tracks || []
        return tracks.length
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
    isLocalId(id) {
      return typeof id === 'string' && id.startsWith('local')
    },
    resolveQueueItemIds(item) {
      if (!item || typeof item !== 'object') {
        return {
          serverLibraryItemId: null,
          localLibraryItemId: null,
          fallbackLibraryItemId: null,
          serverEpisodeId: null,
          localEpisodeId: null,
          fallbackEpisodeId: null
        }
      }

      const libraryItem = item.libraryItem || {}
      const rawLibraryItemId =
        item.libraryItemId ??
        libraryItem.libraryItemId ??
        libraryItem.id ??
        item.id ??
        null
      const serverLibraryItemId =
        item.serverLibraryItemId ??
        (!this.isLocalId(rawLibraryItemId) ? rawLibraryItemId : null) ??
        (!this.isLocalId(libraryItem.id) ? libraryItem.id : null) ??
        (!this.isLocalId(libraryItem.libraryItemId) ? libraryItem.libraryItemId : null) ??
        null
      const localLibraryItemId =
        item.localEpisode?.localLibraryItemId ??
        item.localLibraryItem?.id ??
        item.localLibraryItemId ??
        (this.isLocalId(rawLibraryItemId) ? rawLibraryItemId : null) ??
        (this.isLocalId(libraryItem.id) ? libraryItem.id : null) ??
        null

      const episode = item.episode || {}
      const rawEpisodeId =
        item.episodeId ??
        episode.id ??
        item.localEpisodeId ??
        null
      const serverEpisodeId =
        item.serverEpisodeId ??
        episode.serverEpisodeId ??
        (!this.isLocalId(rawEpisodeId) ? rawEpisodeId : null) ??
        null
      const localEpisodeId =
        item.localEpisode?.id ??
        item.localEpisodeId ??
        (this.isLocalId(rawEpisodeId) ? rawEpisodeId : null) ??
        null

      const fallbackLibraryItemId =
        localLibraryItemId ??
        serverLibraryItemId ??
        rawLibraryItemId ??
        null
      const fallbackEpisodeId =
        localEpisodeId ??
        serverEpisodeId ??
        rawEpisodeId ??
        null

      return {
        serverLibraryItemId,
        localLibraryItemId,
        fallbackLibraryItemId,
        serverEpisodeId,
        localEpisodeId,
        fallbackEpisodeId
      }
    },
    normalizeQueueItem(item) {
      if (!item) return null

      const libraryItem = item.libraryItem || {}
      const rawLibraryItemId =
        item.libraryItemId ??
        libraryItem.libraryItemId ??
        libraryItem.id ??
        item.id ??
        null
      const serverLibraryItemId =
        item.serverLibraryItemId ??
        (!this.isLocalId(rawLibraryItemId) ? rawLibraryItemId : null) ??
        (!this.isLocalId(libraryItem.id) ? libraryItem.id : null) ??
        (!this.isLocalId(libraryItem.libraryItemId) ? libraryItem.libraryItemId : null) ??
        null
      const localLibraryItemId =
        item.localEpisode?.localLibraryItemId ??
        item.localLibraryItem?.id ??
        item.localLibraryItemId ??
        (this.isLocalId(rawLibraryItemId) ? rawLibraryItemId : null) ??
        (this.isLocalId(libraryItem.id) ? libraryItem.id : null) ??
        null

      const episode = item.episode || {}
      const rawEpisodeId =
        item.episodeId ??
        episode.id ??
        item.localEpisodeId ??
        null
      const serverEpisodeId =
        item.serverEpisodeId ??
        episode.serverEpisodeId ??
        (!this.isLocalId(rawEpisodeId) ? rawEpisodeId : null) ??
        null
      const localEpisodeId =
        item.localEpisode?.id ??
        item.localEpisodeId ??
        (this.isLocalId(rawEpisodeId) ? rawEpisodeId : null) ??
        null

      const resolvedLibraryItemId = serverLibraryItemId ?? localLibraryItemId ?? rawLibraryItemId

      if (!resolvedLibraryItemId) return null

      const playbackLibraryItemId =
        item.localLibraryItem?.id || localLibraryItemId || serverLibraryItemId || rawLibraryItemId
      const playbackEpisodeId =
        item.localEpisode?.id || localEpisodeId || serverEpisodeId || rawEpisodeId || null

      if (!playbackLibraryItemId) return null

      return {
        ...item,
        libraryItemId: resolvedLibraryItemId,
        episodeId: serverEpisodeId ?? localEpisodeId ?? rawEpisodeId ?? null,
        serverLibraryItemId,
        serverEpisodeId,
        localLibraryItemId,
        localEpisodeId,
        playbackLibraryItemId,
        playbackEpisodeId
      }
    },
    getNormalizedPlayableItems() {
      const normalized = this.playableItems.map(this.normalizeQueueItem).filter(Boolean)
      const normalizedDetails = {
        totalPlayable: this.playableItems.length,
        normalizedCount: normalized.length,
        sample: normalized.slice(0, 5).map((item) => ({
          libraryItemId: item.libraryItemId,
          episodeId: item.episodeId,
          serverLibraryItemId: item.serverLibraryItemId,
          serverEpisodeId: item.serverEpisodeId,
          localLibraryItemId: item.localLibraryItemId,
          localEpisodeId: item.localEpisodeId,
          playbackLibraryItemId: item.playbackLibraryItemId,
          playbackEpisodeId: item.playbackEpisodeId
        }))
      }
      AbsLogger.info({
        tag: 'PlaylistPage',
        message: `Normalized playable items: ${formatForLog(normalizedDetails)}`
      })
      return normalized
    },
    buildQueueItems() {
      const normalized = this.getNormalizedPlayableItems()
      const queueItems = normalized
        .map((item) => {
          const ids = this.resolveQueueItemIds(item)
          const playbackLibraryItemId =
            item.playbackLibraryItemId || ids.localLibraryItemId || ids.serverLibraryItemId || ids.fallbackLibraryItemId
          const playbackEpisodeId =
            item.playbackEpisodeId ?? ids.localEpisodeId ?? ids.serverEpisodeId ?? ids.fallbackEpisodeId ?? null

          if (!playbackLibraryItemId) return null

          return {
            ...item,
            libraryItemId: ids.fallbackLibraryItemId,
            episodeId: ids.fallbackEpisodeId,
            serverLibraryItemId: ids.serverLibraryItemId,
            serverEpisodeId: ids.serverEpisodeId,
            localLibraryItemId: ids.localLibraryItemId,
            localEpisodeId: ids.localEpisodeId,
            playbackLibraryItemId,
            playbackEpisodeId
          }
        })
        .filter(Boolean)

      const queueSample = queueItems.slice(0, 5).map((item) => ({
        libraryItemId: item.libraryItemId,
        episodeId: item.episodeId,
        serverLibraryItemId: item.serverLibraryItemId,
        serverEpisodeId: item.serverEpisodeId,
        localLibraryItemId: item.localLibraryItemId,
        localEpisodeId: item.localEpisodeId,
        playbackLibraryItemId: item.playbackLibraryItemId,
        playbackEpisodeId: item.playbackEpisodeId
      }))
      AbsLogger.info({
        tag: 'PlaylistPage',
        message: `buildQueueItems complete: ${formatForLog({
          normalizedCount: normalized.length,
          queueCount: queueItems.length,
          sample: queueSample
        })}`
      })

      return queueItems
    },
    async fetchPlaylist() {
      AbsLogger.info({
        tag: 'PlaylistPage',
        message: `Fetch playlist start: ${formatForLog({
          id: this.$route.params.id,
          networkConnected: this.networkConnected,
          autoCacheUnplayedEpisodes: this.autoCacheUnplayedEpisodes
        })}`
      })
      const id = this.$route.params.id
      let playlist
      if (id === 'unfinished') {
        if (!this.autoCacheUnplayedEpisodes) {
          playlist = {
            id: 'unfinished',
            name: this.$strings.LabelAutoUnfinishedPodcasts,
            description: '',
            items: [],
            totalItems: 0
          }
        } else {
          const { items, downloadedEpisodeKeys, totalItems } = await buildUnfinishedAutoPlaylist({
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
            items,
            totalItems
          }

          this.downloadedEpisodeKeys = downloadedEpisodeKeys
        }
      } else {
        if (!this.$store.state.networkConnected) {
          AbsLogger.info({
            tag: 'PlaylistPage',
            message: `Not connected, skip fetching remote playlist: ${formatForLog({ id })}`
          })
          this.checkAutoDownload()
          return
        }
        playlist = await this.$nativeHttp.get(`/api/playlists/${id}`).catch(() => null)
        if (!playlist) return
      }

      AbsLogger.info({
        tag: 'PlaylistPage',
        message: `Playlist fetched: ${formatForLog({
          id: playlist.id,
          items: playlist.items?.length || 0,
          totalItems: playlist.totalItems,
          hasLocalDownloads: !!this.downloadedEpisodeKeys
        })}`
      })

      if (playlist.items.length) {
        const localLibraryItems = (await this.$db.getLocalLibraryItems(playlist.items[0].libraryItem.mediaType)) || []
        if (localLibraryItems.length) {
          const localLibraryItemMap = new Map()
          const localEpisodesByLibraryItemId = new Map()

          localLibraryItems.forEach((localItem) => {
            const libraryItemId = localItem?.libraryItemId
            if (!libraryItemId) return
            localLibraryItemMap.set(libraryItemId, localItem)

            const episodes = localItem?.media?.episodes || []
            if (episodes.length) {
              const episodeMap = new Map()
              episodes.forEach((episode) => {
                const key = episode?.serverEpisodeId || episode?.id
                if (key) {
                  episodeMap.set(key, episode)
                }
              })
              if (episodeMap.size) {
                localEpisodesByLibraryItemId.set(libraryItemId, episodeMap)
              }
            }
          })

          playlist.items.forEach((playlistItem) => {
            const libraryItemId =
              playlistItem.libraryItemId ||
              playlistItem.libraryItem?.id ||
              playlistItem.libraryItem?.libraryItemId ||
              null
            if (!libraryItemId) return

            const matchingLocalLibraryItem = localLibraryItemMap.get(libraryItemId)
            if (!matchingLocalLibraryItem) return

            if (playlistItem.episode) {
              const episodeKey =
                playlistItem.episodeId ||
                playlistItem.episode?.serverEpisodeId ||
                playlistItem.episode?.id ||
                null
              if (!episodeKey) {
                playlistItem.localLibraryItem = matchingLocalLibraryItem
                return
              }

              const matchingLocalEpisode = localEpisodesByLibraryItemId.get(libraryItemId)?.get(episodeKey)
              if (matchingLocalEpisode) {
                playlistItem.localLibraryItem = matchingLocalLibraryItem
                playlistItem.localEpisode = matchingLocalEpisode
              }
            } else {
              playlistItem.localLibraryItem = matchingLocalLibraryItem
            }
          })
        }

        if (!this.downloadedEpisodeKeys) {
          this.downloadedEpisodeKeys = collectDownloadedEpisodeKeys(localLibraryItems)
        }
      }
      playlist.totalItems = playlist.totalItems || playlist.items.length
      await this.$localStore.setCachedPlaylist(toCacheablePlaylist(playlist))
      this.playlist = playlist
      const playlistSummary = {
        id: playlist.id,
        itemCount: playlist.items.length,
        totalItems: playlist.totalItems,
        firstItem: playlist.items[0]
          ? {
              libraryItemId:
                playlist.items[0].libraryItemId ||
                playlist.items[0].libraryItem?.libraryItemId ||
                playlist.items[0].libraryItem?.id,
              episodeId:
                playlist.items[0].episodeId ||
                playlist.items[0].episode?.serverEpisodeId ||
                playlist.items[0].episode?.id,
              hasLocalLibraryItem: !!playlist.items[0].localLibraryItem,
              hasLocalEpisode: !!playlist.items[0].localEpisode
            }
          : null
      }
      AbsLogger.info({
        tag: 'PlaylistPage',
        message: `Playlist ready: ${formatForLog(playlistSummary)}`
      })
      this.checkAutoDownload()
    },
    showMore(playlistItem) {
      const playlistLibraryItemId =
        playlistItem.libraryItemId || playlistItem.libraryItem?.libraryItemId || playlistItem.libraryItem?.id || null
      const playlistEpisodeId =
        playlistItem.episodeId || playlistItem.episode?.serverEpisodeId || playlistItem.episode?.id || null

      const libraryItem = playlistItem.localLibraryItem || playlistItem.libraryItem
      const episode = playlistItem.localEpisode
        ? { ...playlistItem.episode, localEpisode: playlistItem.localEpisode }
        : playlistItem.episode

      this.selectedLibraryItem = libraryItem
        ? {
            ...libraryItem,
            libraryItemId: playlistLibraryItemId || libraryItem.libraryItemId
          }
        : null
      this.selectedEpisode = episode
        ? {
            ...episode,
            serverEpisodeId: playlistEpisodeId || episode?.serverEpisodeId,
            id: playlistEpisodeId || episode?.id || episode?.serverEpisodeId
          }
        : null
      this.selectedLibraryItemId =
        playlistLibraryItemId ||
        null
      this.selectedEpisodeId =
        playlistEpisodeId ||
        null
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
      AbsLogger.info({
        tag: 'PlaylistPage',
        message: `Play button clicked: ${formatForLog({
          playerIsPlaying: this.playerIsPlaying,
          isOpenInPlayer: this.isOpenInPlayer,
          playerIsStartingPlayback: this.playerIsStartingPlayback,
          playlistId: this.playlist.id,
          playlistItems: this.playlist.items.length,
          playableItems: this.playableItems.length
        })}`
      })
      const normalizedQueue = this.buildQueueItems()
      if (!normalizedQueue.length) {
        this.$toast.error('No playable items found')
        return
      }

      const maxQueueItems = MAX_QUEUE_ITEMS
      const queue = maxQueueItems > 0 ? normalizedQueue.slice(0, maxQueueItems) : normalizedQueue
      if (queue.length < normalizedQueue.length) {
        this.$toast.info(`Queue limited to ${queue.length} items`)
      }

      const nextItem = queue[0]
      const queueDetails = {
        normalizedCount: normalizedQueue.length,
        queueCount: queue.length,
        truncated: queue.length < normalizedQueue.length,
        nextItem: {
          playbackLibraryItemId: nextItem.playbackLibraryItemId,
          playbackEpisodeId: nextItem.playbackEpisodeId,
          serverLibraryItemId: nextItem.serverLibraryItemId,
          serverEpisodeId: nextItem.serverEpisodeId,
          localLibraryItemId: nextItem.localLibraryItemId,
          localEpisodeId: nextItem.localEpisodeId
        },
        queueSample: queue.slice(0, 5).map((item) => ({
          playbackLibraryItemId: item.playbackLibraryItemId,
          playbackEpisodeId: item.playbackEpisodeId,
          serverLibraryItemId: item.serverLibraryItemId,
          serverEpisodeId: item.serverEpisodeId,
          localLibraryItemId: item.localLibraryItemId,
          localEpisodeId: item.localEpisodeId
        }))
      }
      AbsLogger.info({
        tag: 'PlaylistPage',
        message: `Queue built for play: ${formatForLog(queueDetails)}`
      })
      this.mediaIdStartingPlayback = nextItem.playbackEpisodeId || nextItem.playbackLibraryItemId
      this.$store.commit('setPlayerIsStartingPlayback', this.mediaIdStartingPlayback)
      this.$store.commit('setPlayQueue', queue)
      this.$store.commit('setQueueIndex', 0)
      const payload = {
        libraryItemId: nextItem.playbackLibraryItemId,
        episodeId: nextItem.playbackEpisodeId,
        serverLibraryItemId: nextItem.serverLibraryItemId,
        serverEpisodeId: nextItem.serverEpisodeId,
        forceLocal: !!nextItem.localLibraryItemId,
        queue,
        queueIndex: 0
      }
      AbsLogger.info({
        tag: 'PlaylistPage',
        message: `Emitting play-item: ${formatForLog({ payload, queueSize: queue.length })}`
      })
      this.$eventBus.$emit('play-item', payload)
    },
    playNextItem() {
      const normalizedQueue = this.buildQueueItems()
      const nowIndex = normalizedQueue.findIndex((i) => {
        return this.$store.getters['getIsMediaStreaming'](
          i.playbackLibraryItemId,
          i.playbackEpisodeId
        )
      })

      const nextItem = normalizedQueue.slice(nowIndex + 1).find((i) => {
        const prog = this.$store.getters['user/getUserMediaProgress'](
          i.serverLibraryItemId || i.playbackLibraryItemId,
          i.serverEpisodeId || i.playbackEpisodeId
        )
        return !prog?.isFinished
      })

      if (nextItem) {
        const nextIndex = normalizedQueue.findIndex((i) => i === nextItem)
        this.mediaIdStartingPlayback = nextItem.playbackEpisodeId || nextItem.playbackLibraryItemId
        this.$store.commit('setPlayerIsStartingPlayback', this.mediaIdStartingPlayback)
        this.$store.commit('setPlayQueue', normalizedQueue)
        this.$store.commit('setQueueIndex', nextIndex)
        const payload = {
          libraryItemId: nextItem.playbackLibraryItemId,
          episodeId: nextItem.playbackEpisodeId,
          serverLibraryItemId: nextItem.serverLibraryItemId,
          serverEpisodeId: nextItem.serverEpisodeId,
          forceLocal: !!nextItem.localLibraryItemId,
          queue: normalizedQueue,
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
      this.$localStore.setCachedPlaylist(toCacheablePlaylist(playlist))
    },
    onAutoPlaylistItemRemoved() {
      if (this.playlist.id !== 'unfinished') return

      const libraryItemId =
        this.selectedLibraryItemId || this.selectedLibraryItem?.libraryItemId || this.selectedLibraryItem?.id
      const episodeId = this.selectedEpisodeId || this.selectedEpisode?.serverEpisodeId || this.selectedEpisode?.id || null
      if (!libraryItemId) return

      const index = this.playlist.items.findIndex((item) => {
        const itemLibraryId = item.libraryItemId || item.libraryItem?.id
        const itemEpisodeId = item.episodeId || item.episode?.serverEpisodeId || item.episode?.id || null
        return itemLibraryId === libraryItemId && itemEpisodeId === episodeId
      })

      if (index >= 0) {
        this.playlist.items.splice(index, 1)
        this.playlist.totalItems = Math.max(0, (this.playlist.totalItems || 0) - 1)
        this.$localStore.setCachedPlaylist(toCacheablePlaylist(this.playlist))
      }

      this.showMoreMenu = false
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

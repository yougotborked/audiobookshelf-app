<template>
  <div>
    <app-audio-player ref="audioPlayer" :bookmarks="bookmarks" :sleep-timer-running="isSleepTimerRunning" :sleep-time-remaining="sleepTimeRemaining" :serverLibraryItemId="serverLibraryItemId" @selectPlaybackSpeed="showPlaybackSpeedModal = true" @updateTime="(t) => (currentTime = t)" @showSleepTimer="showSleepTimer" @showBookmarks="showBookmarks" @skipNextQueue="onSkipNextRequest" @skipPreviousQueue="onSkipPreviousRequest" @openQueue="showQueueModal = true" />

    <modals-playback-speed-modal v-model="showPlaybackSpeedModal" :playback-rate.sync="playbackSpeed" @update:playbackRate="updatePlaybackSpeed" @change="changePlaybackSpeed" />
    <modals-sleep-timer-modal v-model="showSleepTimerModal" :current-time="sleepTimeRemaining" :sleep-timer-running="isSleepTimerRunning" :current-end-of-chapter-time="currentEndOfChapterTime" :is-auto="isAutoSleepTimer" @change="selectSleepTimeout" @cancel="cancelSleepTimer" @increase="increaseSleepTimer" @decrease="decreaseSleepTimer" />
    <modals-bookmarks-modal v-model="showBookmarksModal" :bookmarks="bookmarks" :current-time="currentTime" :library-item-id="serverLibraryItemId" :playback-rate="playbackSpeed" @select="selectBookmark" />
    <modals-queue-modal v-model="showQueueModal" :queue="playQueue" :current-index="queueIndex" @select="selectQueueItem" />
  </div>
</template>

<script>
import { AbsAudioPlayer, AbsLogger } from '@/plugins/capacitor'
import { Dialog } from '@capacitor/dialog'
import CellularPermissionHelpers from '@/mixins/cellularPermissionHelpers'

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
  data() {
    return {
      isReady: false,
      settingsLoaded: false,
      audioPlayerReady: false,
      stream: null,
      download: null,
      showPlaybackSpeedModal: false,
      showBookmarksModal: false,
      showQueueModal: false,
      showSleepTimerModal: false,
      playbackSpeed: 1,
      currentTime: 0,
      isSleepTimerRunning: false,
      sleepTimerEndTime: 0,
      sleepTimeRemaining: 0,
      isAutoSleepTimer: false,
      onLocalMediaProgressUpdateListener: null,
      onSleepTimerEndedListener: null,
      onSleepTimerSetListener: null,
      onMediaPlayerChangedListener: null,
      onCastAvailableUpdateListener: null,
      onCastSupportUpdateListener: null,
      onSkipNextRequestListener: null,
      onSkipPreviousRequestListener: null,
      onQueueIndexUpdateListener: null,
      sleepInterval: null,
      currentEndOfChapterTime: 0,
      serverLibraryItemId: null,
      serverEpisodeId: null
    }
  },
  mixins: [CellularPermissionHelpers],
  computed: {
    bookmarks() {
      if (!this.serverLibraryItemId) return []
      return this.$store.getters['user/getUserBookmarksForItem'](this.serverLibraryItemId)
    },
    isIos() {
      return this.$platform === 'ios'
    },
    playQueue() {
      return this.$store.state.playQueue
    },
    queueIndex() {
      return this.$store.state.queueIndex
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
    getQueuePayload(queue, preferServerIds = false) {
      if (!Array.isArray(queue)) return []
      return queue
        .map((item) => {
          const ids = this.resolveQueueItemIds(item)

          let libraryItemId = preferServerIds
            ? ids.serverLibraryItemId ?? ids.fallbackLibraryItemId
            : ids.localLibraryItemId || ids.fallbackLibraryItemId

          if (!libraryItemId) return null
          if (preferServerIds && this.isLocalId(libraryItemId)) {
            libraryItemId = ids.fallbackLibraryItemId
            if (!libraryItemId || this.isLocalId(libraryItemId)) return null
          }

          let episodeId = null
          if (preferServerIds) {
            episodeId = ids.serverEpisodeId ?? ids.fallbackEpisodeId ?? null
            if (episodeId && this.isLocalId(episodeId)) {
              episodeId = ids.fallbackEpisodeId ?? null
            }
          } else {
            episodeId = ids.localEpisodeId ?? ids.serverEpisodeId ?? ids.fallbackEpisodeId
          }

          const payload = { libraryItemId }
          if (episodeId) payload.episodeId = episodeId
          return payload
        })
        .filter(Boolean)
    },
    resolveQueueIndex(queuePayload, libraryItemId, episodeId, fallbackIndex = 0) {
      if (!Array.isArray(queuePayload) || !queuePayload.length) return 0
      const normalizedEpisodeId = episodeId || null
      const idx = queuePayload.findIndex((entry) => {
        if (entry.libraryItemId !== libraryItemId) return false
        const entryEpisodeId = entry.episodeId || null
        return entryEpisodeId === normalizedEpisodeId
      })
      if (idx >= 0) return idx
      const safeFallback = Math.max(0, Math.min(fallbackIndex ?? 0, queuePayload.length - 1))
      return safeFallback
    },
    showBookmarks() {
      this.showBookmarksModal = true
    },
    selectBookmark(bookmark) {
      this.showBookmarksModal = false
      if (!bookmark || isNaN(bookmark.time)) return
      const bookmarkTime = Number(bookmark.time)
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.seek(bookmarkTime)
      }
    },
    onSleepTimerEnded({ value: currentPosition }) {
      this.isSleepTimerRunning = false
      if (currentPosition) {
        AbsLogger.info({
          tag: 'AudioPlayerContainer',
          message: `Sleep Timer Ended Current Position: ${currentPosition}`
        })
      }
    },
    onSleepTimerSet(payload) {
      const { value: sleepTimeRemaining, isAuto } = payload
      AbsLogger.info({
        tag: 'AudioPlayerContainer',
        message: `SLEEP TIMER SET: ${formatForLog(payload)}`
      })
      if (sleepTimeRemaining === 0) {
        AbsLogger.info({ tag: 'AudioPlayerContainer', message: 'Sleep timer canceled' })
        this.isSleepTimerRunning = false
      } else {
        this.isSleepTimerRunning = true
      }

      this.isAutoSleepTimer = !!isAuto
      this.sleepTimeRemaining = sleepTimeRemaining
    },
    showSleepTimer() {
      if (this.$refs.audioPlayer && this.$refs.audioPlayer.currentChapter) {
        this.currentEndOfChapterTime = Math.floor(this.$refs.audioPlayer.currentChapter.end)
      } else {
        this.currentEndOfChapterTime = 0
      }
      this.showSleepTimerModal = true
    },
    async selectSleepTimeout({ time, isChapterTime }) {
      AbsLogger.info({
        tag: 'AudioPlayerContainer',
        message: `Setting sleep timer: ${formatForLog({ time, isChapterTime })}`
      })
      var res = await AbsAudioPlayer.setSleepTimer({ time: String(time), isChapterTime })
      if (!res.success) {
        return this.$toast.error('Sleep timer did not set, invalid time')
      }
    },
    increaseSleepTimer() {
      // Default time to increase = 5 min
      AbsAudioPlayer.increaseSleepTime({ time: '300000' })
    },
    decreaseSleepTimer() {
      AbsAudioPlayer.decreaseSleepTime({ time: '300000' })
    },
    async cancelSleepTimer() {
      AbsLogger.info({ tag: 'AudioPlayerContainer', message: 'Canceling sleep timer' })
      await AbsAudioPlayer.cancelSleepTimer()
    },
    streamClosed() {
      AbsLogger.info({ tag: 'AudioPlayerContainer', message: 'Stream Closed' })
    },
    streamProgress(data) {
      if (!data.numSegments) return
      const chunks = data.chunks
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setChunksReady(chunks, data.numSegments)
      }
    },
    streamReady() {
      AbsLogger.info({ tag: 'AudioPlayerContainer', message: '[StreamContainer] Stream Ready' })
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setStreamReady()
      }
    },
    streamReset({ streamId, startTime }) {
        AbsLogger.info({
          tag: 'AudioPlayerContainer',
          message: `received stream reset: ${formatForLog({ streamId, startTime })}`
        })
      if (this.$refs.audioPlayer) {
        if (this.stream && this.stream.id === streamId) {
          this.$refs.audioPlayer.resetStream(startTime)
        }
      }
    },
    updatePlaybackSpeed(speed) {
      if (this.$refs.audioPlayer) {
        AbsLogger.info({
          tag: 'AudioPlayerContainer',
          message: `[AudioPlayerContainer] Update Playback Speed: ${speed}`
        })
        this.$refs.audioPlayer.setPlaybackSpeed(speed)
      }
    },
    changePlaybackSpeed(speed) {
      AbsLogger.info({
        tag: 'AudioPlayerContainer',
        message: `[AudioPlayerContainer] Change Playback Speed: ${speed}`
      })
      this.$store.dispatch('user/updateUserSettings', { playbackRate: speed })
    },
    settingsUpdated(settings) {
      AbsLogger.info({
        tag: 'AudioPlayerContainer',
        message: `[AudioPlayerContainer] Settings Update | PlaybackRate: ${settings.playbackRate}`
      })
      this.playbackSpeed = settings.playbackRate
      if (this.$refs.audioPlayer && this.$refs.audioPlayer.currentPlaybackRate !== settings.playbackRate) {
        AbsLogger.info({
          tag: 'AudioPlayerContainer',
          message: `[AudioPlayerContainer] PlaybackRate Updated: ${this.playbackSpeed}`
        })
        this.$refs.audioPlayer.setPlaybackSpeed(this.playbackSpeed)
      }

      // Settings have been loaded (at least once, so it's safe to kickoff onReady)
      if (!this.settingsLoaded) {
        this.settingsLoaded = true
        this.notifyOnReady()
      }
    },
    closeStreamOnly() {
      // If user logs out or disconnects from server and not playing local
      if (this.$refs.audioPlayer && !this.$refs.audioPlayer.isLocalPlayMethod) {
        this.$refs.audioPlayer.closePlayback()
      }
    },
    castLocalItem() {
      let libraryItemId = this.serverLibraryItemId
      let episodeId = this.serverEpisodeId
      if (!libraryItemId) {
        const session = this.$store.state.currentPlaybackSession
        if (session) {
          if (session.libraryItemId && !session.libraryItemId.startsWith('local')) {
            libraryItemId = session.libraryItemId
            episodeId = session.episodeId
          } else if (session.localLibraryItem?.libraryItemId) {
            libraryItemId = session.localLibraryItem.libraryItemId
            episodeId = session.localEpisode?.serverEpisodeId || null
          }
        }
      }
      if (!libraryItemId) {
        this.$toast.error(`Cannot cast locally downloaded media`)
        return
      }
      // Change to server library item
      this.playServerLibraryItemAndCast(libraryItemId, episodeId)
    },
    playServerLibraryItemAndCast(libraryItemId, episodeId) {
      var playbackRate = 1
      if (this.$refs.audioPlayer) {
        playbackRate = this.$refs.audioPlayer.currentPlaybackRate || 1
      }
      const startTime = Math.floor(this.currentTime || 0)
      const queuePayload = this.getQueuePayload(this.$store.state.playQueue, true)
      const payload = { libraryItemId, episodeId, playWhenReady: false, playbackRate }
      if (queuePayload.length) {
        payload.queue = queuePayload
        const fallbackIndex = this.$store.state.queueIndex ?? 0
        payload.queueIndex = this.resolveQueueIndex(queuePayload, libraryItemId, episodeId || null, fallbackIndex)
      }
      if (startTime) payload.startTime = startTime
      AbsAudioPlayer.prepareLibraryItem(payload)
        .then((data) => {
          if (data.error) {
            const errorMsg = data.error || 'Failed to play'
            this.$toast.error(errorMsg)
          } else {
            AbsLogger.info({
              tag: 'AudioPlayerContainer',
              message: `Library item play response: ${formatForLog(data)}`
            })
            this.serverLibraryItemId = libraryItemId
            this.serverEpisodeId = episodeId
            AbsAudioPlayer.requestSession()
          }
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error('Failed to play')
        })
    },
    async playLibraryItem(payload) {
      await AbsLogger.info({
        tag: 'AudioPlayerContainer',
        message: `playLibraryItem: Received play request for library item ${payload.libraryItemId} ${payload.episodeId ? `episode ${payload.episodeId}` : ''}`
      })
      AbsLogger.info({
        tag: 'AudioPlayerContainer',
        message: `[AudioPlayerContainer] playLibraryItem received: ${formatForLog({
          payload,
          storeQueueSize: this.$store.state.playQueue.length,
          storeQueueIndex: this.$store.state.queueIndex,
          isCasting: this.$store.state.isCasting
        })}`
      })
      const ids = this.resolveQueueItemIds(payload)
      const canUseServerIds = !!ids.serverLibraryItemId && !this.isLocalId(ids.serverLibraryItemId)
      const shouldUseServerIds = this.$store.state.isCasting && canUseServerIds && !payload.forceLocal
      AbsLogger.info({
        tag: 'AudioPlayerContainer',
        message: `[AudioPlayerContainer] Resolved IDs for play: ${formatForLog({
          ids,
          canUseServerIds,
          shouldUseServerIds,
          forceLocal: payload.forceLocal
        })}`
      })
      let libraryItemId = shouldUseServerIds
        ? ids.serverLibraryItemId
        : ids.localLibraryItemId || ids.fallbackLibraryItemId
      let episodeId = shouldUseServerIds
        ? ids.serverEpisodeId
        : ids.localEpisodeId ?? ids.serverEpisodeId ?? ids.fallbackEpisodeId
      if (!libraryItemId) {
        this.$store.commit('setPlayerDoneStartingPlayback')
        this.$toast.error('Unable to determine item to play')
        return
      }
      const startTime = payload.startTime
      const startWhenReady = !payload.paused

      const isLocal = this.isLocalId(libraryItemId)
      if (!isLocal) {
        const hasPermission = await this.checkCellularPermission('streaming')
        if (!hasPermission) {
          this.$store.commit('setPlayerDoneStartingPlayback')
          return
        }
      }

      // When playing local library item and can also play this item from the server
      //   then store the server library item id so it can be used if a cast is made
      const serverLibraryItemId = ids.serverLibraryItemId || payload.serverLibraryItemId || null
      const serverEpisodeId = ids.serverEpisodeId || payload.serverEpisodeId || null

      if (this.$store.state.isCasting && isLocal) {
        const { value } = await Dialog.confirm({
          title: 'Warning',
          message: `Cannot cast downloaded media items. Confirm to close cast and play on your device.`
        })
        if (!value) {
          this.$store.commit('setPlayerDoneStartingPlayback')
          return
        }
      }

      // if already playing this item then jump to start time
      if (this.$store.getters['getIsMediaStreaming'](libraryItemId, episodeId)) {
        AbsLogger.info({
          tag: 'AudioPlayerContainer',
          message: `Already streaming item: ${formatForLog({ startTime })}`
        })
        if (startTime !== undefined && startTime !== null) {
          // seek to start time
          AbsAudioPlayer.seek({ value: Math.floor(startTime) })
        } else if (this.$refs.audioPlayer) {
          this.$refs.audioPlayer.play()
        }
        this.$store.commit('setPlayerDoneStartingPlayback')
        return
      }

      this.serverLibraryItemId = null
      this.serverEpisodeId = null

      let playbackRate = 1
      if (this.$refs.audioPlayer) {
        playbackRate = this.$refs.audioPlayer.currentPlaybackRate || 1
      }

      if (payload.queue) {
        this.$store.commit('setPlayQueue', payload.queue)
        if (payload.queueIndex !== undefined) {
          this.$store.commit('setQueueIndex', payload.queueIndex)
        } else {
          const idx = payload.queue.findIndex((q) => {
            const queueIds = this.resolveQueueItemIds(q)
            const queueLibraryItemId = shouldUseServerIds
              ? queueIds.serverLibraryItemId
              : queueIds.localLibraryItemId || queueIds.fallbackLibraryItemId
            const queueEpisodeId = shouldUseServerIds
              ? queueIds.serverEpisodeId
              : queueIds.localEpisodeId ?? queueIds.serverEpisodeId ?? queueIds.fallbackEpisodeId
            if (!queueLibraryItemId) return false
            return (
              queueLibraryItemId === libraryItemId && (queueEpisodeId || null) === (episodeId || null)
            )
          })
          if (idx >= 0) this.$store.commit('setQueueIndex', idx)
        }
      } else {
        this.$store.commit('setPlayQueue', [payload])
        this.$store.commit('setQueueIndex', 0)
      }

      AbsLogger.info({
        tag: 'AudioPlayerContainer',
        message: `Called playLibraryItem: ${libraryItemId}`
      })
      const queuePayload = this.getQueuePayload(this.$store.state.playQueue, shouldUseServerIds)
      AbsLogger.info({
        tag: 'AudioPlayerContainer',
        message: `[AudioPlayerContainer] Queue payload prepared: ${formatForLog({
          preferServerIds: shouldUseServerIds,
          originalQueueSize: this.$store.state.playQueue.length,
          queuePayloadSize: queuePayload.length,
          queuePayloadSample: queuePayload.slice(0, 5)
        })}`
      })
      const preparePayload = {
        libraryItemId,
        episodeId,
        playWhenReady: startWhenReady,
        playbackRate
      }
      if (queuePayload.length) {
        preparePayload.queue = queuePayload
        const fallbackIndex = this.$store.state.queueIndex ?? 0
        preparePayload.queueIndex = this.resolveQueueIndex(queuePayload, libraryItemId, episodeId || null, fallbackIndex)
      }
      if (startTime !== undefined && startTime !== null) preparePayload.startTime = startTime
      AbsLogger.info({
        tag: 'AudioPlayerContainer',
        message: `[AudioPlayerContainer] Calling AbsAudioPlayer.prepareLibraryItem: ${formatForLog({ preparePayload })}`
      })
      AbsAudioPlayer.prepareLibraryItem(preparePayload)
        .then((data) => {
          if (data.error) {
            const errorMsg = data.error || 'Failed to play'
            this.$toast.error(errorMsg)
          } else {
            AbsLogger.info({
              tag: 'AudioPlayerContainer',
              message: `Library item play response: ${formatForLog(data)}`
            })
            if (!this.isLocalId(libraryItemId)) {
              this.serverLibraryItemId = libraryItemId
            } else if (serverLibraryItemId && !this.isLocalId(serverLibraryItemId)) {
              this.serverLibraryItemId = serverLibraryItemId
            } else {
              this.serverLibraryItemId = null
            }
            if (episodeId && !this.isLocalId(episodeId)) {
              this.serverEpisodeId = episodeId
            } else if (serverEpisodeId && !this.isLocalId(serverEpisodeId)) {
              this.serverEpisodeId = serverEpisodeId
            } else {
              this.serverEpisodeId = null
            }
            if (this.$store.state.isCasting) {
              AbsAudioPlayer.requestSession()
            }
          }
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error('Failed to play')
        })
        .finally(() => {
          this.$store.commit('setPlayerDoneStartingPlayback')
        })
    },
    pauseItem() {
      if (this.$refs.audioPlayer && this.$refs.audioPlayer.isPlaying) {
        this.$refs.audioPlayer.pause()
      }
    },
    onLocalMediaProgressUpdate(localMediaProgress) {
      AbsLogger.info({
        tag: 'AudioPlayerContainer',
        message: `Got local media progress update: ${formatForLog({
          progress: localMediaProgress.progress,
          payload: localMediaProgress
        })}`
      })
      this.$store.commit('globals/updateLocalMediaProgress', localMediaProgress)
    },
    onMediaPlayerChanged(data) {
      this.$store.commit('setMediaPlayer', data.value)
    },
    onReady() {
      // The UI is reporting elsewhere we are ready
      this.isReady = true
      this.notifyOnReady()
    },
    notifyOnReady() {
      // TODO: was used on iOS to open last played media. May be removed
      if (!this.isIos) return

      // If settings aren't loaded yet, native player will receive incorrect settings
      AbsLogger.info({
        tag: 'AudioPlayerContainer',
        message: `Notify on ready... settingsLoaded: ${this.settingsLoaded}, isReady: ${this.isReady}`
      })
      if (this.settingsLoaded && this.isReady && this.$store.state.isFirstAudioLoad) {
        this.$store.commit('setIsFirstAudioLoad', false) // Only run this once on app launch
        AbsAudioPlayer.onReady()
      }
    },
    playbackTimeUpdate(currentTime) {
      this.$refs.audioPlayer?.seek(currentTime)
    },
    /**
     * When device gains focus then refresh the timestamps in the audio player
     */
    deviceFocused(hasFocus) {
      if (!this.$store.state.currentPlaybackSession) return

      if (hasFocus) {
        if (!this.$refs.audioPlayer?.isPlaying) {
          const playbackSession = this.$store.state.currentPlaybackSession
          if (this.$refs.audioPlayer.isLocalPlayMethod) {
            const localLibraryItemId = playbackSession.localLibraryItem?.id
            const localEpisodeId = playbackSession.localEpisodeId
            if (!localLibraryItemId) {
              AbsLogger.error({
                tag: 'AudioPlayerContainer',
                message: `[AudioPlayerContainer] device visibility: no local library item for session ${formatForLog(playbackSession)}`
              })
              return
            }
            const localMediaProgress = this.$store.state.globals.localMediaProgress.find((mp) => {
              if (localEpisodeId) return mp.localEpisodeId === localEpisodeId
              return mp.localLibraryItemId === localLibraryItemId
            })
            if (localMediaProgress) {
              AbsLogger.info({
                tag: 'AudioPlayerContainer',
                message: `[AudioPlayerContainer] device visibility: found local media progress: ${formatForLog({
                  currentTime: localMediaProgress.currentTime,
                  playerCurrentTime: this.currentTime
                })}`
              })
              this.$refs.audioPlayer.currentTime = localMediaProgress.currentTime
              this.$refs.audioPlayer.timeupdate()
            } else {
              AbsLogger.error({
                tag: 'AudioPlayerContainer',
                message: '[AudioPlayerContainer] device visibility: Local media progress not found'
              })
            }
          } else {
            const libraryItemId = playbackSession.libraryItemId
            const episodeId = playbackSession.episodeId
            const url = episodeId ? `/api/me/progress/${libraryItemId}/${episodeId}` : `/api/me/progress/${libraryItemId}`
            this.$nativeHttp
              .get(url)
              .then((data) => {
                if (!this.$refs.audioPlayer?.isPlaying && data.libraryItemId === libraryItemId) {
                  AbsLogger.info({
                    tag: 'AudioPlayerContainer',
                    message: `[AudioPlayerContainer] device visibility: got server media progress: ${formatForLog({
                      currentTime: data.currentTime,
                      playerCurrentTime: this.currentTime
                    })}`
                  })
                  this.$refs.audioPlayer.currentTime = data.currentTime
                  this.$refs.audioPlayer.timeupdate()
                }
              })
              .catch((error) => {
                AbsLogger.error({
                  tag: 'AudioPlayerContainer',
                  message: `[AudioPlayerContainer] device visibility: Failed to get progress ${formatForLog(error)}`
                })
              })
          }
        }
      }
    },

    onSkipNextRequest() {
      const nextItem = this.$store.getters['getNextQueueItem']
      if (nextItem) {
        this.playLibraryItem({
          libraryItemId: nextItem.localLibraryItem?.id || nextItem.libraryItemId,
          episodeId: nextItem.localEpisode?.id || nextItem.episodeId,
          serverLibraryItemId: nextItem.libraryItemId,
          serverEpisodeId: nextItem.episodeId,
          queue: this.$store.state.playQueue,
          queueIndex: this.$store.state.queueIndex + 1
        })
      }
    },
    onSkipPreviousRequest() {
      const idx = this.$store.state.queueIndex
      if (idx > 0) {
        const prevItem = this.$store.state.playQueue[idx - 1]
        this.playLibraryItem({
          libraryItemId: prevItem.localLibraryItem?.id || prevItem.libraryItemId,
          episodeId: prevItem.localEpisode?.id || prevItem.episodeId,
          serverLibraryItemId: prevItem.libraryItemId,
          serverEpisodeId: prevItem.episodeId,
          queue: this.$store.state.playQueue,
          queueIndex: idx - 1
        })
      }
    },
    onQueueIndexUpdate({ value }) {
      if (typeof value === 'number') {
        this.$store.commit('setQueueIndex', value)
      }
    },
    selectQueueItem(index) {
      const item = this.$store.state.playQueue[index]
      if (!item) return
      this.playLibraryItem({
        libraryItemId: item.localLibraryItem?.id || item.libraryItemId,
        episodeId: item.localEpisode?.id || item.episodeId,
        serverLibraryItemId: item.libraryItemId,
        serverEpisodeId: item.episodeId,
        queue: this.$store.state.playQueue,
        queueIndex: index
      })
      this.showQueueModal = false
    },
    onPlaybackEnded() {
      const nextItem = this.$store.getters['getNextQueueItem']
      if (nextItem) {
        this.onSkipNextRequest()
      }
    }
  },
  async mounted() {
    this.onLocalMediaProgressUpdateListener = await AbsAudioPlayer.addListener('onLocalMediaProgressUpdate', this.onLocalMediaProgressUpdate)
    this.onSleepTimerEndedListener = await AbsAudioPlayer.addListener('onSleepTimerEnded', this.onSleepTimerEnded)
    this.onSleepTimerSetListener = await AbsAudioPlayer.addListener('onSleepTimerSet', this.onSleepTimerSet)
    this.onMediaPlayerChangedListener = await AbsAudioPlayer.addListener('onMediaPlayerChanged', this.onMediaPlayerChanged)
    this.onCastAvailableUpdateListener = await AbsAudioPlayer.addListener('onCastAvailableUpdate', ({ value }) => {
      this.$store.commit('setCastAvailable', value)
    })
    this.onCastSupportUpdateListener = await AbsAudioPlayer.addListener('onCastSupportUpdate', ({ value }) => {
      this.$store.commit('setCastEnabled', value)
    })
    this.onSkipNextRequestListener = await AbsAudioPlayer.addListener('onSkipNextRequest', this.onSkipNextRequest)
    this.onSkipPreviousRequestListener = await AbsAudioPlayer.addListener('onSkipPreviousRequest', this.onSkipPreviousRequest)
    this.onQueueIndexUpdateListener = await AbsAudioPlayer.addListener('onQueueIndexUpdate', this.onQueueIndexUpdate)

    AbsAudioPlayer.getIsCastAvailable().then(({ value }) => {
      this.$store.commit('setCastAvailable', value)
    })
    AbsAudioPlayer.getIsCastSupported?.().then?.(({ value }) => {
      this.$store.commit('setCastEnabled', value)
    })

    this.playbackSpeed = this.$store.getters['user/getUserSetting']('playbackRate')
    AbsLogger.info({
      tag: 'AudioPlayerContainer',
      message: `[AudioPlayerContainer] Init Playback Speed: ${this.playbackSpeed}`
    })

    this.$eventBus.$on('abs-ui-ready', this.onReady)
    this.$eventBus.$on('play-item', this.playLibraryItem)
    this.$eventBus.$on('pause-item', this.pauseItem)
    this.$eventBus.$on('close-stream', this.closeStreamOnly)
    this.$eventBus.$on('cast-local-item', this.castLocalItem)
    this.$eventBus.$on('user-settings', this.settingsUpdated)
    this.$eventBus.$on('playback-time-update', this.playbackTimeUpdate)
    this.$eventBus.$on('device-focus-update', this.deviceFocused)
    this.$eventBus.$on('playback-ended', this.onPlaybackEnded)

    if (
      this.$store.state.currentPlaybackSession &&
      this.$store.state.isCasting
    ) {
      AbsAudioPlayer.requestSession()
    }

    if (this.$store.state.playQueue.length) {
      AbsAudioPlayer.setPlayQueue({
        queue: this.$store.state.playQueue,
        queueIndex: this.$store.state.queueIndex
      })
    }
  },
  beforeDestroy() {
    this.onLocalMediaProgressUpdateListener?.remove()
    this.onSleepTimerEndedListener?.remove()
    this.onSleepTimerSetListener?.remove()
    this.onMediaPlayerChangedListener?.remove()
    this.onCastAvailableUpdateListener?.remove()
    this.onCastSupportUpdateListener?.remove()
    this.onSkipNextRequestListener?.remove()
    this.onSkipPreviousRequestListener?.remove()
    this.onQueueIndexUpdateListener?.remove()

    this.$eventBus.$off('abs-ui-ready', this.onReady)
    this.$eventBus.$off('play-item', this.playLibraryItem)
    this.$eventBus.$off('pause-item', this.pauseItem)
    this.$eventBus.$off('close-stream', this.closeStreamOnly)
    this.$eventBus.$off('cast-local-item', this.castLocalItem)
    this.$eventBus.$off('user-settings', this.settingsUpdated)
    this.$eventBus.$off('playback-time-update', this.playbackTimeUpdate)
    this.$eventBus.$off('device-focus-update', this.deviceFocused)
    this.$eventBus.$off('playback-ended', this.onPlaybackEnded)
  }
}
</script>

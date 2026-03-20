import { defineStore } from 'pinia'
import { Network } from '@capacitor/network'
import { AbsAudioPlayer, AbsDownloader, AbsLogger } from '~/plugins/capacitor'
import { PlayMethod } from '~/constants'
import type { PlaybackSession, DeviceData, QueueItem } from '~/types'

// Helper functions (copy from store/index.js)
function resolveQueueItemIds(item: Record<string, unknown>): { libraryItemId: string | null; episodeId: string | null } {
  if (!item || typeof item !== 'object') {
    return { libraryItemId: null, episodeId: null }
  }

  const libraryItem = (item.libraryItem as Record<string, unknown>) || {}
  const libraryItemId =
    (item.libraryItemId as string) ??
    (item.serverLibraryItemId as string) ??
    (libraryItem.libraryItemId as string) ??
    (libraryItem.id as string) ??
    ((item.localLibraryItem as Record<string, unknown>)?.id as string) ??
    (item.localLibraryItemId as string) ??
    ((item.localEpisode as Record<string, unknown>)?.localLibraryItemId as string) ??
    (item.id as string) ??
    null

  const episode = (item.episode as Record<string, unknown>) || {}
  const episodeId =
    (item.episodeId as string) ??
    (item.serverEpisodeId as string) ??
    (episode.serverEpisodeId as string) ??
    (episode.id as string) ??
    (item.localEpisodeId as string) ??
    ((item.localEpisode as Record<string, unknown>)?.id as string) ??
    null

  return { libraryItemId, episodeId }
}

function sanitizeQueue(queue: QueueItem[] = []): QueueItem[] {
  const sanitized: QueueItem[] = []
  queue.forEach((item) => {
    const ids = resolveQueueItemIds(item as unknown as Record<string, unknown>)
    if (!ids.libraryItemId) return
    sanitized.push({ ...item, libraryItemId: ids.libraryItemId, episodeId: ids.episodeId ?? item.episodeId ?? null })
  })
  return sanitized
}

interface AppState {
  deviceData: DeviceData | null
  currentPlaybackSession: PlaybackSession | null
  playerIsPlaying: boolean
  playerIsFullscreen: boolean
  playerIsStartingPlayback: boolean
  playerStartingPlaybackMediaId: string | null
  isCasting: boolean
  isCastAvailable: boolean
  isCastEnabled: boolean
  attemptingConnection: boolean
  socketConnected: boolean
  networkConnected: boolean
  networkConnectionType: string | null
  serverReachable: boolean
  isNetworkUnmetered: boolean
  isFirstLoad: boolean
  isFirstAudioLoad: boolean
  hasStoragePermission: boolean
  selectedLibraryItem: Record<string, unknown> | null
  showReader: boolean
  ereaderKeepProgress: boolean
  ereaderFileId: string | null
  showSideDrawer: boolean
  isNetworkListenerInit: boolean
  serverSettings: Record<string, unknown> | null
  lastBookshelfScrollData: Record<string, { scrollTop: number; path: string }>
  lastItemScrollData: Record<string, unknown>
  playQueue: QueueItem[]
  queueIndex: number | null
  autoDownloadIntervalId: ReturnType<typeof setInterval> | null
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    deviceData: null,
    currentPlaybackSession: null,
    playerIsPlaying: false,
    playerIsFullscreen: false,
    playerIsStartingPlayback: false,
    playerStartingPlaybackMediaId: null,
    isCasting: false,
    isCastAvailable: false,
    isCastEnabled: false,
    attemptingConnection: false,
    socketConnected: false,
    networkConnected: false,
    networkConnectionType: null,
    serverReachable: true,
    isNetworkUnmetered: true,
    isFirstLoad: true,
    isFirstAudioLoad: true,
    hasStoragePermission: false,
    selectedLibraryItem: null,
    showReader: false,
    ereaderKeepProgress: false,
    ereaderFileId: null,
    showSideDrawer: false,
    isNetworkListenerInit: false,
    serverSettings: null,
    lastBookshelfScrollData: {},
    lastItemScrollData: {},
    playQueue: [],
    queueIndex: null,
    autoDownloadIntervalId: null
  }),

  getters: {
    getCurrentPlaybackSessionId: (state) => state.currentPlaybackSession?.id || null,
    getIsPlayerOpen: (state) => !!state.currentPlaybackSession,
    getIsCurrentSessionLocal: (state) => state.currentPlaybackSession?.playMethod == PlayMethod.LOCAL,
    getIsMediaStreaming: (state) => (libraryItemId: string, episodeId?: string | null) => {
      if (!state.currentPlaybackSession || !libraryItemId) return false
      const isLocalLibraryItemId = libraryItemId.startsWith('local_')
      if (isLocalLibraryItemId) {
        if ((state.currentPlaybackSession as Record<string, unknown>).localLibraryItem &&
            ((state.currentPlaybackSession as Record<string, unknown>).localLibraryItem as Record<string, unknown>)?.id !== libraryItemId) {
          return false
        }
        if (!episodeId) return true
        return state.currentPlaybackSession.localEpisodeId === episodeId
      }
      if (state.currentPlaybackSession.libraryItemId !== libraryItemId) return false
      if (!episodeId) return true
      return state.currentPlaybackSession.episodeId === episodeId
    },
    getServerSetting: (state) => (key: string) => {
      if (!state.serverSettings) return null
      return state.serverSettings[key]
    },
    getJumpForwardTime: (state) => state.deviceData?.deviceSettings?.jumpForwardTime || 10,
    getJumpBackwardsTime: (state) => state.deviceData?.deviceSettings?.jumpBackwardsTime || 10,
    getAltViewEnabled: (state) => {
      if (!state.deviceData?.deviceSettings) return true
      return state.deviceData.deviceSettings.enableAltView
    },
    getOrientationLockSetting: (state) => state.deviceData?.deviceSettings?.lockOrientation,
    getCanDownloadUsingCellular: (state) => state.deviceData?.deviceSettings?.downloadUsingCellular || 'ALWAYS',
    getCanStreamingUsingCellular: (state) => state.deviceData?.deviceSettings?.streamingUsingCellular || 'ALWAYS',
    getDoesServerImagesRequireToken: (state) => {
      const serverVersion = state.serverSettings?.version as string | undefined
      if (!serverVersion) return false
      const [major, minor] = serverVersion.split('.').map(Number)
      return major < 2 || (major === 2 && minor < 17)
    },
    getPlayQueue: (state) => state.playQueue,
    getQueueIndex: (state) => state.queueIndex,
    getNextQueueItem: (state) => {
      if (state.queueIndex === null) return null
      return state.playQueue[state.queueIndex + 1] || null
    },
    getPreviousQueueItem: (state) => {
      if (state.queueIndex === null) return null
      if (state.queueIndex === 0) return null
      return state.playQueue[state.queueIndex - 1] || null
    }
  },

  actions: {
    async init() {
      const localStore = useLocalStore()
      const queue = sanitizeQueue((await localStore.getPlayQueue()) as QueueItem[])
      let index = await localStore.getQueueIndex()
      let session = await localStore.getPlaybackSession()

      const deviceSession = this.deviceData?.lastPlaybackSession
      if (deviceSession) {
        if (!session || session.id !== deviceSession.id) {
          session = deviceSession
          await localStore.setPlaybackSession(session)
        }
        const idx = queue.findIndex((q) => {
          const liId = (q.localLibraryItem as Record<string, unknown>)?.id || q.libraryItemId
          const epId = (q.localEpisode as Record<string, unknown>)?.id || q.episodeId
          const curLi = (deviceSession.localLibraryItem as Record<string, unknown>)?.id || deviceSession.libraryItemId
          const curEp = deviceSession.localEpisodeId || deviceSession.episodeId
          return liId === curLi && epId === curEp
        })
        if (idx >= 0 && idx !== index) {
          index = idx
          await localStore.setQueueIndex(index)
        }
      }

      if (!queue.length) {
        index = null
      } else if (typeof index !== 'number' || index < 0 || index >= queue.length) {
        index = 0
        await localStore.setQueueIndex(index)
      }

      this.playQueue = sanitizeQueue(queue)
      this.queueIndex = index
      this.currentPlaybackSession = session as PlaybackSession | null

      const librariesStore = useLibrariesStore()
      const autoUnfinished = this.deviceData?.deviceSettings?.autoCacheUnplayedEpisodes
      const hasCachedPlaylists = await localStore.hasCachedPlaylists()
      if (autoUnfinished || hasCachedPlaylists) {
        librariesStore.numUserPlaylists = 1
      }

      this.startAutoDownloadTimer()
    },

    startAutoDownloadTimer() {
      if (this.autoDownloadIntervalId) return
      const id = setInterval(() => {
        this.autoDownloadCheck()
      }, 30 * 60 * 1000)
      this.autoDownloadIntervalId = id
      this.autoDownloadCheck()
    },

    stopAutoDownloadTimer() {
      if (this.autoDownloadIntervalId) {
        clearInterval(this.autoDownloadIntervalId)
        this.autoDownloadIntervalId = null
      }
    },

    async autoDownloadCheck() {
      if (!this.deviceData?.deviceSettings?.autoCacheUnplayedEpisodes) return
      if (!this.networkConnected) return
      const userStore = useUserStore()
      if (!userStore.user) return

      const userMediaProgress = (userStore.user?.mediaProgress as Record<string, unknown>[]) || []
      const globalsStore = useGlobalsStore()
      const localMediaProgress = (globalsStore.localMediaProgress as Record<string, unknown>[]) || []

      const progressMap: Record<string, unknown> = {}
      userMediaProgress.forEach((mp: Record<string, unknown>) => {
        if (mp.episodeId) progressMap[mp.episodeId as string] = mp
      })
      localMediaProgress.forEach((mp: Record<string, unknown>) => {
        if (mp?.episodeId && !progressMap[mp.episodeId as string]) {
          progressMap[mp.episodeId as string] = mp
        }
      })

      const db = useDb()
      const localLibraries = await db.getLocalLibraryItems('podcast')
      const downloadedMap: Record<string, boolean> = {}
      for (const li of localLibraries as Record<string, unknown>[]) {
        for (const ep of (li.media as Record<string, unknown>)?.episodes as Record<string, unknown>[] || []) {
          const sid = (ep.serverEpisodeId || ep.id) as string
          if (sid) downloadedMap[`${li.libraryItemId}_${sid}`] = true
        }
      }

      const librariesStore = useLibrariesStore()
      const nativeHttp = useNativeHttp()
      for (const lib of librariesStore.libraries) {
        if ((lib as Record<string, unknown>).mediaType !== 'podcast') continue
        let page = 0
        while (true) {
          const payload = await nativeHttp.get(`/api/libraries/${(lib as Record<string, unknown>).id}/recent-episodes?limit=200&page=${page}`, { connectTimeout: 10000 }).catch(() => null)
          const episodes = (payload as Record<string, unknown>)?.episodes as Record<string, unknown>[] || []
          for (const ep of episodes) {
            const serverId = ep.id as string
            const liId = ep.libraryItemId as string
            if (!serverId || !liId) continue
            const prog = progressMap[serverId] as Record<string, unknown>
            if (prog && prog.isFinished) continue
            if (downloadedMap[`${liId}_${serverId}`]) continue
            AbsDownloader.downloadLibraryItem({ libraryItemId: liId, episodeId: serverId })
            downloadedMap[`${liId}_${serverId}`] = true
          }
          if (episodes.length < 200) break
          page++
        }
      }
    },

    async setupNetworkListener() {
      if (this.isNetworkListenerInit) return
      this.isNetworkListenerInit = true

      const status = await Network.getStatus()
      AbsLogger.info({ tag: 'Store', message: `Network status: ${JSON.stringify(status)}` })
      this.setNetworkStatus(status)

      Network.addListener('networkStatusChange', (status) => {
        AbsLogger.info({ tag: 'Store', message: `Network status changed: ${JSON.stringify({ connected: status.connected, connectionType: status.connectionType })}` })
        this.setNetworkStatus(status)
      })

      AbsAudioPlayer.addListener('onNetworkMeteredChanged', (payload: { value: boolean }) => {
        AbsLogger.info({ tag: 'Store', message: `On network metered changed: ${JSON.stringify({ isUnmetered: payload.value })}` })
        this.isNetworkUnmetered = payload.value
      })
    },

    setDeviceData(deviceData: DeviceData | null) {
      this.deviceData = deviceData
      if (deviceData?.deviceSettings?.autoCacheUnplayedEpisodes) {
        this.startAutoDownloadTimer()
      } else {
        this.stopAutoDownloadTimer()
      }
    },

    setLastBookshelfScrollData({ scrollTop, path, name }: { scrollTop: number; path: string; name: string }) {
      this.lastBookshelfScrollData[name] = { scrollTop, path }
    },

    setLastItemScrollData(data: Record<string, unknown>) {
      this.lastItemScrollData = data
    },

    setPlaybackSession(playbackSession: PlaybackSession | null) {
      this.currentPlaybackSession = playbackSession
      this.isCasting = playbackSession?.mediaPlayer === 'cast-player'
      useLocalStore().setPlaybackSession(playbackSession)

      if (playbackSession && this.playQueue.length) {
        const idx = this.playQueue.findIndex((q) => {
          const liId = (q.localLibraryItem as Record<string, unknown>)?.id || q.libraryItemId
          const epId = (q.localEpisode as Record<string, unknown>)?.id || q.episodeId
          const curLi = (playbackSession.localLibraryItem as Record<string, unknown>)?.id || playbackSession.libraryItemId
          const curEp = playbackSession.localEpisodeId || playbackSession.episodeId
          return liId === curLi && epId === curEp
        })
        if (idx >= 0) this.queueIndex = idx
      }
    },

    setNetworkStatus(val: { connected: boolean; connectionType: string }) {
      if (val.connectionType !== 'none') {
        this.networkConnected = true
      } else {
        this.networkConnected = false
      }
      const platform = usePlatform()
      if (platform === 'ios') {
        this.networkConnected = true
      }
      this.networkConnectionType = val.connectionType
    },

    setPlayQueue(queue: QueueItem[]) {
      const incomingSummary = {
        incomingLength: Array.isArray(queue) ? queue.length : 0,
        sample: Array.isArray(queue) ? queue.slice(0, 5).map((item) => ({
          libraryItemId: item?.libraryItemId,
          episodeId: item?.episodeId
        })) : []
      }
      AbsLogger.info({ tag: 'Store', message: `[Store] setPlayQueue called: ${JSON.stringify(incomingSummary)}` })
      this.playQueue = sanitizeQueue(queue)
      AbsLogger.info({ tag: 'Store', message: `[Store] setPlayQueue sanitized length: ${this.playQueue.length}` })
      useLocalStore().setPlayQueue(this.playQueue)
    },

    setQueueIndex(index: number | null) {
      this.queueIndex = index
      AbsLogger.info({ tag: 'Store', message: `[Store] setQueueIndex: ${JSON.stringify({ queueIndex: index, queueLength: this.playQueue.length })}` })
      useLocalStore().setQueueIndex(index)
    },

    reorderQueue({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) {
      const item = this.playQueue.splice(oldIndex, 1)[0]
      this.playQueue.splice(newIndex, 0, item)
      if (this.queueIndex === oldIndex) {
        this.queueIndex = newIndex
      } else if (this.queueIndex !== null && this.queueIndex > oldIndex && this.queueIndex <= newIndex) {
        this.queueIndex--
      } else if (this.queueIndex !== null && this.queueIndex < oldIndex && this.queueIndex >= newIndex) {
        this.queueIndex++
      }
    },

    removeQueueItem(index: number) {
      this.playQueue.splice(index, 1)
      if (this.queueIndex !== null) {
        if (this.queueIndex > index) {
          this.queueIndex--
        } else if (this.queueIndex === index) {
          if (this.queueIndex >= this.playQueue.length) {
            this.queueIndex = this.playQueue.length - 1
          }
        }
      }
      if (!this.playQueue.length) this.queueIndex = null
    },

    clearPlayQueue() {
      this.playQueue = []
      this.queueIndex = null
    },

    setServerSettings(val: Record<string, unknown> | null) {
      this.serverSettings = val
      useLocalStore().setServerSettings(val)
    }
  }
})

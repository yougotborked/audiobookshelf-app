import { Network } from '@capacitor/network'
import { AbsAudioPlayer, AbsDownloader } from '@/plugins/capacitor'
import { PlayMethod } from '@/plugins/constants'

export const state = () => ({
  deviceData: null,
  currentPlaybackSession: null,
  playerIsPlaying: false,
  playerIsFullscreen: false,
  playerIsStartingPlayback: false, // When pressing play before native play response
  playerStartingPlaybackMediaId: null,
  isCasting: false,
  isCastAvailable: false,
  attemptingConnection: false,
  socketConnected: false,
  networkConnected: false,
  networkConnectionType: null,
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
})

export const getters = {
  getCurrentPlaybackSessionId: (state) => {
    return state.currentPlaybackSession?.id || null
  },
  getIsPlayerOpen: (state) => {
    return !!state.currentPlaybackSession
  },
  getIsCurrentSessionLocal: (state) => {
    return state.currentPlaybackSession?.playMethod == PlayMethod.LOCAL
  },
  getIsMediaStreaming: (state) => (libraryItemId, episodeId) => {
    if (!state.currentPlaybackSession || !libraryItemId) return false

    // Check using local library item id and local episode id
    const isLocalLibraryItemId = libraryItemId.startsWith('local_')
    if (isLocalLibraryItemId) {
      if (state.currentPlaybackSession.localLibraryItem?.id !== libraryItemId) {
        return false
      }
      if (!episodeId) return true
      return state.currentPlaybackSession.localEpisodeId === episodeId
    }

    if (state.currentPlaybackSession.libraryItemId !== libraryItemId) {
      return false
    }
    if (!episodeId) return true
    return state.currentPlaybackSession.episodeId === episodeId
  },
  getServerSetting: (state) => (key) => {
    if (!state.serverSettings) return null
    return state.serverSettings[key]
  },
  getJumpForwardTime: (state) => {
    if (!state.deviceData?.deviceSettings) return 10
    return state.deviceData.deviceSettings.jumpForwardTime || 10
  },
  getJumpBackwardsTime: (state) => {
    if (!state.deviceData?.deviceSettings) return 10
    return state.deviceData.deviceSettings.jumpBackwardsTime || 10
  },
  getAltViewEnabled: (state) => {
    if (!state.deviceData?.deviceSettings) return true
    return state.deviceData.deviceSettings.enableAltView
  },
  getOrientationLockSetting: (state) => {
    return state.deviceData?.deviceSettings?.lockOrientation
  },
  getCanDownloadUsingCellular: (state) => {
    if (!state.deviceData?.deviceSettings?.downloadUsingCellular) return 'ALWAYS'
    return state.deviceData.deviceSettings.downloadUsingCellular || 'ALWAYS'
  },
  getCanStreamingUsingCellular: (state) => {
    if (!state.deviceData?.deviceSettings?.streamingUsingCellular) return 'ALWAYS'
    return state.deviceData.deviceSettings.streamingUsingCellular || 'ALWAYS'
  },
  /**
   * Old server versions require a token for images
   *
   * @param {*} state
   * @returns {boolean} True if server version is less than 2.17
   */
  getDoesServerImagesRequireToken: (state) => {
    const serverVersion = state.serverSettings?.version
    if (!serverVersion) return false
    const versionParts = serverVersion.split('.')
    const majorVersion = parseInt(versionParts[0])
    const minorVersion = parseInt(versionParts[1])
    return majorVersion < 2 || (majorVersion == 2 && minorVersion < 17)
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
}

export const actions = {
  async init({ commit, dispatch }) {
    const queue = await this.$localStore.getPlayQueue()
    let index = await this.$localStore.getQueueIndex()
    let session = await this.$localStore.getPlaybackSession()

    // If the native layer has a more recent playback session use that instead
    const deviceSession = this.state.deviceData?.lastPlaybackSession
    if (deviceSession) {
      if (!session || session.id !== deviceSession.id) {
        session = deviceSession
        await this.$localStore.setPlaybackSession(session)
      }

      const idx = queue.findIndex((q) => {
        const liId = q.localLibraryItem?.id || q.libraryItemId
        const epId = q.localEpisode?.id || q.episodeId
        const curLi = deviceSession.localLibraryItem?.id || deviceSession.libraryItemId
        const curEp = deviceSession.localEpisodeId || deviceSession.episodeId
        return liId === curLi && epId === curEp
      })
      if (idx >= 0 && idx !== index) {
        index = idx
        await this.$localStore.setQueueIndex(index)
      }
    }

    commit('setPlayQueue', queue)
    commit('setQueueIndex', index)
    commit('setPlaybackSession', session)
    dispatch('startAutoDownloadTimer')
  },
  startAutoDownloadTimer({ state, dispatch, commit }) {
    if (state.autoDownloadIntervalId) return
    const id = setInterval(() => {
      dispatch('autoDownloadCheck')
    }, 30 * 60 * 1000)
    commit('setAutoDownloadIntervalId', id)
    dispatch('autoDownloadCheck')
  },
  stopAutoDownloadTimer({ state, commit }) {
    if (state.autoDownloadIntervalId) {
      clearInterval(state.autoDownloadIntervalId)
      commit('setAutoDownloadIntervalId', null)
    }
  },
  async autoDownloadCheck({ state }) {
    if (!state.deviceData?.deviceSettings?.autoCacheUnplayedEpisodes) return

    const progressMap = {}
    ;(state.user?.user?.mediaProgress || []).forEach((mp) => {
      if (mp.episodeId) progressMap[mp.episodeId] = mp
    })

    const localLibraries = await this.$db.getLocalLibraryItems('podcast')
    const downloadedMap = {}
    for (const li of localLibraries) {
      for (const ep of li.media?.episodes || []) {
        const sid = ep.serverEpisodeId || ep.id
        if (sid) downloadedMap[`${li.libraryItemId}_${sid}`] = true
      }
    }

    const libraries = state.libraries?.libraries || []
    for (const lib of libraries) {
      if (lib.mediaType !== 'podcast') continue
      let page = 0
      while (true) {
        const payload = await this.$nativeHttp
          .get(`/api/libraries/${lib.id}/recent-episodes?limit=200&page=${page}`)
          .catch(() => null)
        const episodes = payload?.episodes || []
        for (const ep of episodes) {
          const serverId = ep.id
          const liId = ep.libraryItemId
          if (!serverId || !liId) continue
          const prog = progressMap[serverId]
          if (prog && prog.isFinished) continue
          if (downloadedMap[`${liId}_${serverId}`]) continue
          AbsDownloader.downloadLibraryItem({
            libraryItemId: liId,
            episodeId: serverId
          })
        }
        if (episodes.length < 200) break
        page++
      }
    }
  },
  // Listen for network connection
  async setupNetworkListener({ state, commit }) {
    if (state.isNetworkListenerInit) return
    commit('setNetworkListenerInit', true)

    const status = await Network.getStatus()
    console.log('Network status', status)
    commit('setNetworkStatus', status)

    Network.addListener('networkStatusChange', (status) => {
      console.log('Network status changed', status.connected, status.connectionType)
      commit('setNetworkStatus', status)
    })

    AbsAudioPlayer.addListener('onNetworkMeteredChanged', (payload) => {
      const isUnmetered = payload.value
      console.log('On network metered changed', isUnmetered)
      commit('setIsNetworkUnmetered', isUnmetered)
    })
  }
}

export const mutations = {
  setDeviceData(state, deviceData) {
    state.deviceData = deviceData

    // Ensure auto download timer reflects the "auto cache unplayed episodes" setting
    if (deviceData?.deviceSettings?.autoCacheUnplayedEpisodes) {
      this.dispatch('startAutoDownloadTimer')
    } else {
      this.dispatch('stopAutoDownloadTimer')
    }
  },
  setLastBookshelfScrollData(state, { scrollTop, path, name }) {
    state.lastBookshelfScrollData[name] = { scrollTop, path }
  },
  setLastItemScrollData(state, data) {
    state.lastItemScrollData = data
  },
  setPlaybackSession(state, playbackSession) {
    state.currentPlaybackSession = playbackSession

    state.isCasting = playbackSession?.mediaPlayer === 'cast-player'

    this.$localStore.setPlaybackSession(playbackSession)

    if (playbackSession && state.playQueue.length) {
      const idx = state.playQueue.findIndex((q) => {
        const liId = q.localLibraryItem?.id || q.libraryItemId
        const epId = q.localEpisode?.id || q.episodeId
        const curLi = playbackSession.localLibraryItem?.id || playbackSession.libraryItemId
        const curEp = playbackSession.localEpisodeId || playbackSession.episodeId
        return liId === curLi && epId === curEp
      })
      if (idx >= 0) state.queueIndex = idx
    }
  },
  setMediaPlayer(state, mediaPlayer) {
    state.isCasting = mediaPlayer === 'cast-player'
  },
  setCastAvailable(state, available) {
    state.isCastAvailable = available
  },
  setAttemptingConnection(state, val) {
    state.attemptingConnection = val
  },
  setPlayerPlaying(state, val) {
    state.playerIsPlaying = val
  },
  setPlayerFullscreen(state, val) {
    state.playerIsFullscreen = val
  },
  setPlayerIsStartingPlayback(state, mediaId) {
    state.playerStartingPlaybackMediaId = mediaId
    state.playerIsStartingPlayback = true
  },
  setPlayerDoneStartingPlayback(state) {
    state.playerStartingPlaybackMediaId = null
    state.playerIsStartingPlayback = false
  },
  setHasStoragePermission(state, val) {
    state.hasStoragePermission = val
  },
  setIsFirstLoad(state, val) {
    state.isFirstLoad = val
  },
  setIsFirstAudioLoad(state, val) {
    state.isFirstAudioLoad = val
  },
  setSocketConnected(state, val) {
    state.socketConnected = val
  },
  setNetworkListenerInit(state, val) {
    state.isNetworkListenerInit = val
  },
  setNetworkStatus(state, val) {
    if (val.connectionType !== 'none') {
      state.networkConnected = true
    } else {
      state.networkConnected = false
    }
    if (this.$platform === 'ios') {
      // Capacitor Network plugin only shows ios device connected if internet access is available.
      // This fix allows iOS users to use local servers without internet access.
      state.networkConnected = true
    }
    state.networkConnectionType = val.connectionType
  },
  setIsNetworkUnmetered(state, val) {
    state.isNetworkUnmetered = val
  },
  showReader(state, { libraryItem, keepProgress, fileId }) {
    state.selectedLibraryItem = libraryItem
    state.ereaderKeepProgress = keepProgress
    state.ereaderFileId = fileId

    state.showReader = true
  },
  setShowReader(state, val) {
    state.showReader = val
  },
  setShowSideDrawer(state, val) {
    state.showSideDrawer = val
  },
  setPlayQueue(state, queue) {
    state.playQueue = queue || []
    this.$localStore.setPlayQueue(state.playQueue)
  },
  setQueueIndex(state, index) {
    state.queueIndex = index
    this.$localStore.setQueueIndex(index)
  },
  reorderQueue(state, { oldIndex, newIndex }) {
    const item = state.playQueue.splice(oldIndex, 1)[0]
    state.playQueue.splice(newIndex, 0, item)
    if (state.queueIndex === oldIndex) {
      state.queueIndex = newIndex
    } else if (state.queueIndex > oldIndex && state.queueIndex <= newIndex) {
      state.queueIndex--
    } else if (state.queueIndex < oldIndex && state.queueIndex >= newIndex) {
      state.queueIndex++
    }
  },
  removeQueueItem(state, index) {
    state.playQueue.splice(index, 1)
    if (state.queueIndex > index) {
      state.queueIndex--
    } else if (state.queueIndex === index) {
      if (state.queueIndex >= state.playQueue.length) {
        state.queueIndex = state.playQueue.length - 1
      }
    }
    if (!state.playQueue.length) state.queueIndex = null
  },
  clearPlayQueue(state) {
    state.playQueue = []
    state.queueIndex = null
  },
  setAutoDownloadIntervalId(state, id) {
    state.autoDownloadIntervalId = id
  },
  setServerSettings(state, val) {
    state.serverSettings = val
    this.$localStore.setServerSettings(state.serverSettings)
  }
}

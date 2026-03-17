<template>
  <div class="w-full layout-wrapper bg-md-surface-1">
    <app-appbar />
    <div id="content" class="overflow-hidden relative" :class="appStore.getIsPlayerOpen ? 'playerOpen' : ''">
      <slot />
    </div>
    <app-audio-player-container ref="streamContainer" />
    <modals-libraries-modal />
    <modals-playlists-add-create-modal />
    <modals-select-local-folder-modal />
    <modals-rssfeeds-rss-feed-modal />
    <app-side-drawer />
    <readers-reader />
  </div>
</template>

<script setup lang="ts">
import { CapacitorHttp } from '@capacitor/core'
import { AbsLogger } from '~/plugins/capacitor'

const appStore = useAppStore()
const userStore = useUserStore()
const librariesStore = useLibrariesStore()
const globalsStore = useGlobalsStore()
const router = useRouter()
const route = useRoute()
const config = useRuntimeConfig()
const { isValidVersion, setOrientationLock } = useUtils()
const bus = useEventBus()

const inittingLibraries = ref(false)
const hasMounted = ref(false)
const disconnectTime = ref(0)
const timeLostFocus = ref(0)
const connectionRetryTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

const streamContainer = ref<{ audioPlayerReady: boolean; streamOpen: (stream: unknown) => void } | null>(null)

// Watchers
watch(() => appStore.networkConnected, (newVal, oldVal) => {
  if (!hasMounted.value) return
  if (newVal) {
    console.log(`[default] network connected changed ${oldVal} -> ${newVal}`)
    if (!userStore.user) {
      attemptConnection()
    } else if (!librariesStore.currentLibraryId) {
      initLibraries()
    } else {
      const timeSinceDisconnect = Date.now() - disconnectTime.value
      if (timeSinceDisconnect > 5000) {
        console.log('Time since disconnect was', timeSinceDisconnect, 'sync with server')
        setTimeout(() => { syncLocalSessions(false) }, 4000)
      }
    }
    if (userStore.user && librariesStore.currentLibraryId) {
      appStore.autoDownloadCheck()
    }
  } else {
    console.log('[default] lost network connection')
    disconnectTime.value = Date.now()
    clearConnectionRetry()
  }
})

watch(() => appStore.socketConnected, (newVal) => {
  if (newVal) {
    clearConnectionRetry()
  } else {
    scheduleConnectionRetry(1200)
  }
})

watch(() => appStore.serverReachable, (newVal) => {
  if (newVal) {
    clearConnectionRetry()
  } else {
    scheduleConnectionRetry(2000)
  }
})

// Methods
function initialStream(stream: unknown) {
  if (streamContainer.value?.audioPlayerReady) {
    streamContainer.value.streamOpen(stream)
  }
}

async function loadSavedSettings() {
  const userSavedServerSettings = await useLocalStore().getServerSettings()
  if (userSavedServerSettings) {
    appStore.setServerSettings(userSavedServerSettings)
  }
  await userStore.loadUserSettings()
}

async function attemptConnection() {
  console.warn('[default] attemptConnection')
  if (!appStore.networkConnected) {
    console.warn('[default] No network connection')
    await AbsLogger.info({ tag: 'default', message: 'attemptConnection: No network connection' })
    return
  }
  if (appStore.attemptingConnection) return
  appStore.attemptingConnection = true

  const deviceData = await useDb().getDeviceData() as Record<string, unknown> | null
  let serverConfig: Record<string, unknown> | null = null
  if (deviceData) {
    globalsStore.hapticFeedback = (deviceData.deviceSettings as Record<string, unknown>)?.hapticFeedback as string || 'LIGHT'
    if (deviceData.lastServerConnectionConfigId && (deviceData.serverConnectionConfigs as unknown[])?.length) {
      serverConfig = (deviceData.serverConnectionConfigs as Record<string, unknown>[]).find(
        (scc) => scc.id == deviceData.lastServerConnectionConfigId
      ) || null
    }
  }

  if (!serverConfig) {
    appStore.attemptingConnection = false
    await AbsLogger.info({ tag: 'default', message: 'attemptConnection: No last server config set' })
    return
  }

  await AbsLogger.info({ tag: 'default', message: `attemptConnection: Got server config, attempt authorize (${serverConfig.name})` })

  const nativeHttpOptions = {
    headers: { Authorization: `Bearer ${serverConfig.token}` },
    connectTimeout: 6000,
    serverConnectionConfig: serverConfig as { id: string; address: string; token?: string; refreshToken?: string }
  }
  const authRes = await useNativeHttp().post(`${serverConfig.address}/api/authorize`, null, nativeHttpOptions).catch(() => false) as Record<string, unknown> | false

  if (!authRes) {
    appStore.attemptingConnection = false
    scheduleConnectionRetry(5000)
    return
  }

  const { user, userDefaultLibraryId, serverSettings, ereaderDevices } = authRes as Record<string, unknown>
  appStore.setServerSettings(serverSettings as Record<string, unknown>)
  librariesStore.ereaderDevices = ereaderDevices as unknown[]

  const serverSettingsObj = serverSettings as Record<string, unknown>
  const userObj = user as Record<string, unknown>
  if (isValidVersion(serverSettingsObj.version as string, '2.26.0')) {
    if (serverConfig.token === userObj.token || userObj.isOldToken) {
      appStore.attemptingConnection = false
      await AbsLogger.info({ tag: 'default', message: `attemptConnection: Old token detected, requesting re-login` })
      await userStore.logout()
      router.push(`/connect?error=oldAuthToken&serverConnectionConfigId=${serverConfig.id}`)
      return
    }
    serverConfig.token = userStore.accessToken || serverConfig.token
  }

  const lastLibraryId = await useLocalStore().getLastLibraryId()
  const userLibrariesAccessible = (userObj.librariesAccessible as string[]) || []
  if (lastLibraryId && (!userLibrariesAccessible.length || userLibrariesAccessible.includes(lastLibraryId))) {
    librariesStore.currentLibraryId = lastLibraryId
  } else if (userDefaultLibraryId) {
    librariesStore.currentLibraryId = userDefaultLibraryId as string
  }

  serverConfig.version = serverSettingsObj.version
  const savedServerConnectionConfig = await useDb().setServerConnectionConfig(serverConfig) as Record<string, unknown>

  userStore.user = userObj
  userStore.accessToken = (savedServerConnectionConfig.token || serverConfig.token) as string
  userStore.serverConnectionConfig = savedServerConnectionConfig as import('~/types').ServerConnectionConfig

  useSocket().connect(savedServerConnectionConfig.address as string, savedServerConnectionConfig.token as string)

  await AbsLogger.info({ tag: 'default', message: `attemptConnection: Successful connection (${savedServerConnectionConfig.name})` })
  await initLibraries()
  appStore.attemptingConnection = false
}

async function initLibraries() {
  if (inittingLibraries.value) return
  inittingLibraries.value = true
  try {
    await librariesStore.load()
    await AbsLogger.info({ tag: 'default', message: `initLibraries loading library ${librariesStore.getCurrentLibraryName}` })
    await librariesStore.fetch(librariesStore.currentLibraryId)
    bus.emit('library-changed', librariesStore.currentLibraryId)
    if (userStore.user) {
      await appStore.autoDownloadCheck()
    }
  } finally {
    inittingLibraries.value = false
  }
}

async function syncLocalSessions(isFirstSync: boolean) {
  if (!userStore.user) {
    console.log('[default] No need to sync local sessions - not connected to server')
    return
  }
  await AbsLogger.info({ tag: 'default', message: 'Calling syncLocalSessions' })
  const response = await useDb().syncLocalSessionsWithServer(isFirstSync) as Record<string, unknown> | null
  if (response?.error) {
    console.error('[default] Failed to sync local sessions', response.error)
  } else {
    console.log('[default] Successfully synced local sessions')
    await globalsStore.loadLocalMediaProgress()
  }
}

function userUpdated(user: Record<string, unknown>) {
  if (userStore.user?.id == user.id) {
    userStore.user = user
  }
}

async function userMediaProgressUpdated(payload: Record<string, unknown>) {
  const prog = payload.data as Record<string, unknown>
  await AbsLogger.info({ tag: 'default', message: `userMediaProgressUpdate: Received updated media progress. Media item id ${payload.id}` })

  const isMediaOpenInPlayer = appStore.getIsMediaStreaming(prog.libraryItemId as string, prog.episodeId as string)
  if (isMediaOpenInPlayer && appStore.getCurrentPlaybackSessionId !== payload.sessionId && !appStore.playerIsPlaying) {
    await AbsLogger.info({ tag: 'default', message: `userMediaProgressUpdate: Item in player, paused, from different session. Updating to ${(payload.data as Record<string, unknown>).currentTime}` })
    bus.emit('playback-time-update', { currentTime: (payload.data as Record<string, unknown>).currentTime as number, duration: 0 })
  }

  const localProg = await useDb().getLocalMediaProgressForServerItem({ libraryItemId: prog.libraryItemId, episodeId: prog.episodeId }) as Record<string, unknown> | null
  let newLocalMediaProgress: Record<string, unknown> | null = null

  if (localProg && (localProg.lastUpdate as number) < (prog.lastUpdate as number)) {
    if (localProg.currentTime == prog.currentTime && localProg.isFinished == prog.isFinished) {
      await AbsLogger.info({ tag: 'default', message: `userMediaProgressUpdate: server lastUpdate is more recent but progress is up-to-date` })
      return
    }
    await AbsLogger.info({ tag: 'default', message: `userMediaProgressUpdate: syncing progress from server` })
    newLocalMediaProgress = await useDb().syncServerMediaProgressWithLocalMediaProgress({
      localMediaProgressId: localProg.id,
      mediaProgress: prog
    }) as Record<string, unknown> | null
  } else if (!localProg) {
    const localLibraryItem = await useDb().getLocalLibraryItemByLId(prog.libraryItemId as string) as Record<string, unknown> | null
    if (localLibraryItem) {
      if (prog.episodeId) {
        const lliEpisodes = ((localLibraryItem.media as Record<string, unknown>)?.episodes as Record<string, unknown>[]) || []
        const localEpisode = lliEpisodes.find((ep) => ep.serverEpisodeId === prog.episodeId)
        if (localEpisode) {
          newLocalMediaProgress = await useDb().syncServerMediaProgressWithLocalMediaProgress({
            localLibraryItemId: localLibraryItem.id,
            localEpisodeId: localEpisode.id,
            mediaProgress: prog
          }) as Record<string, unknown> | null
        }
      } else {
        newLocalMediaProgress = await useDb().syncServerMediaProgressWithLocalMediaProgress({
          localLibraryItemId: localLibraryItem.id,
          mediaProgress: prog
        }) as Record<string, unknown> | null
      }
    } else {
      console.log(`[default] userMediaProgressUpdate no local media progress or lli found for ${prog.id}`)
    }
  }

  if (newLocalMediaProgress?.id) {
    await AbsLogger.info({ tag: 'default', message: `userMediaProgressUpdate: local media progress updated for ${newLocalMediaProgress.id}` })
    globalsStore.updateLocalMediaProgress(newLocalMediaProgress as Parameters<typeof globalsStore.updateLocalMediaProgress>[0])
  }
}

async function visibilityChanged() {
  if (document.visibilityState === 'visible') {
    const elapsed = Date.now() - timeLostFocus.value
    console.log(`✅ [default] device visibility: has focus (${elapsed}ms out of focus)`)
    if (elapsed > 30000) {
      console.log('✅ [default] reloading local media progress')
      await globalsStore.loadLocalMediaProgress()
    }
    bus.emit('device-focus-update', true)
  } else {
    console.log('⛔️ [default] device visibility: does NOT have focus')
    timeLostFocus.value = Date.now()
    bus.emit('device-focus-update', false)
  }
}

function changeLanguage(code: string) {
  console.log('Changed lang', code)
  document.documentElement.lang = code
}

function scheduleConnectionRetry(delay = 2000) {
  if (connectionRetryTimeout.value) return
  if (!appStore.networkConnected) return
  if (!userStore.user && !userStore.serverConnectionConfig) return

  console.log(`[default] scheduling connection retry in ${delay}ms`)
  connectionRetryTimeout.value = setTimeout(() => {
    connectionRetryTimeout.value = null
    retryConnectionIfNeeded().catch((error) => {
      console.error('[default] retryConnectionIfNeeded failed', error)
    })
  }, Math.max(delay, 0))
}

function clearConnectionRetry() {
  if (connectionRetryTimeout.value) {
    clearTimeout(connectionRetryTimeout.value)
    connectionRetryTimeout.value = null
  }
}

async function retryConnectionIfNeeded() {
  if (!appStore.networkConnected) return
  if (appStore.attemptingConnection) return

  const hasUser = !!userStore.user
  const serverConfig = userStore.serverConnectionConfig

  if (!hasUser) {
    await attemptConnection()
    return
  }

  if (!serverConfig?.address || !serverConfig?.token) {
    console.warn('[default] No server config available for retry connection')
    return
  }

  const socket = useSocket()
  const socketIsConnected = (socket as unknown as Record<string, unknown>)?.socket
    ? ((socket as unknown as Record<string, unknown>).socket as Record<string, unknown>)?.connected
    : false

  if (!socketIsConnected) {
    console.log('[default] Socket disconnected, reconnecting')
    socket.logout()
    socket.connect(serverConfig.address, serverConfig.token)
  } else if (!socket.isAuthenticated) {
    console.log('[default] Socket connected but unauthenticated, sending auth event')
    socket.sendAuthenticate()
  }

  try {
    await syncLocalSessions(false)
  } catch (error) {
    console.error('[default] retryConnectionIfNeeded sync failed', error)
  } finally {
    if (!appStore.serverReachable) {
      scheduleConnectionRetry(5000)
    }
  }
}

// Lifecycle
onMounted(async () => {
  bus.on('change-lang', changeLanguage)
  document.addEventListener('visibilitychange', visibilityChanged)

  const socket = useSocket()
  socket.$on('user_updated', userUpdated)
  socket.$on('user_media_progress_updated', userMediaProgressUpdated)

  if (appStore.isFirstLoad) {
    await AbsLogger.info({ tag: 'default', message: `mounted: initializing first load (${usePlatform()} v${config.public.version})` })
    appStore.isFirstLoad = false

    loadSavedSettings()

    const deviceData = await useDb().getDeviceData() as Record<string, unknown> | null
    appStore.setDeviceData(deviceData)

    if (deviceData?.lastServerConnectionConfigId && (deviceData.serverConnectionConfigs as unknown[])?.length) {
      const scc = (deviceData.serverConnectionConfigs as Record<string, unknown>[]).find(
        (s) => s.id == deviceData.lastServerConnectionConfigId
      )
      if (scc) {
        userStore.accessToken = scc.token as string
        userStore.serverConnectionConfig = scc as import('~/types').ServerConnectionConfig
      }
    }

    setOrientationLock(appStore.getOrientationLockSetting)

    await appStore.init()
    await appStore.setupNetworkListener()

    const serverConfig = userStore.serverConnectionConfig
    if (serverConfig && userStore.user) {
      await AbsLogger.info({ tag: 'default', message: `mounted: Server connected, init libraries (${userStore.getServerConfigName})` })
      await initLibraries()
    } else if (serverConfig) {
      await AbsLogger.info({ tag: 'default', message: `mounted: Server config found, attempting connection (${userStore.getServerConfigName})` })
      await attemptConnection()
    } else {
      await AbsLogger.info({ tag: 'default', message: 'mounted: No server config, redirecting to connect' })
      router.push('/connect')
      return
    }

    await syncLocalSessions(true)
    hasMounted.value = true

    await AbsLogger.info({ tag: 'default', message: 'mounted: fully initialized' })
    bus.emit('abs-ui-ready')
  }
})

onBeforeUnmount(() => {
  bus.off('change-lang', changeLanguage)
  document.removeEventListener('visibilitychange', visibilityChanged)
  const socket = useSocket()
  socket.$off('user_updated', userUpdated)
  socket.$off('user_media_progress_updated', userMediaProgressUpdated)
  clearConnectionRetry()
})
</script>

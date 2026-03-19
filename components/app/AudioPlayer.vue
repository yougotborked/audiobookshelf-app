<template>
  <div v-if="playbackSession" id="streamContainer" class="fixed top-0 left-0 layout-wrapper right-0 z-50 pointer-events-none" :class="{ fullscreen: showFullscreen, 'ios-player': platform === 'ios', 'web-player': platform === 'web' }">
    <div v-if="showFullscreen" class="w-full h-full z-10 absolute top-0 left-0 pointer-events-auto" :style="{ backgroundColor: coverRgb }">
      <div class="w-full h-full absolute top-0 left-0 pointer-events-none" style="background: var(--gradient-audio-player)" />
      <!-- Darkening overlay: always applied for contrast, heavier for light cover art -->
      <div class="w-full h-full absolute top-0 left-0 pointer-events-none" :style="{ background: coverBgIsLight && theme !== 'black' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.4)' }" />

      <div class="top-4 left-4 absolute cursor-pointer">
        <span class="material-symbols text-5xl" @click="collapseFullscreen">keyboard_arrow_down</span>
      </div>
      <div
        v-show="showCastBtn"
        class="top-6 right-16 absolute cursor-pointer"
        :class="{ 'opacity-60': !castAvailable && !isCasting }"
      >
        <span
          class="material-symbols text-3xl"
          @click="castClick"
        >{{ isCasting ? 'cast_connected' : 'cast' }}</span>
      </div>
      <div class="top-6 right-4 absolute cursor-pointer">
        <span class="material-symbols text-3xl" @click="showMoreMenuDialog = true">more_vert</span>
      </div>
      <p class="top-4 absolute left-0 right-0 mx-auto text-center uppercase tracking-widest text-white/75" style="font-size: 10px">{{ isDirectPlayMethod ? getString('LabelPlaybackDirect') : isLocalPlayMethod ? getString('LabelPlaybackLocal') : getString('LabelPlaybackTranscode') }}</p>
    </div>

    <div v-if="playerSettings.useChapterTrack && playerSettings.useTotalTrack && showFullscreen" class="absolute total-track w-full z-30 px-6">
      <div class="flex">
        <p class="font-mono text-md-on-surface" style="font-size: 0.8rem">{{ currentTimePretty }}</p>
        <div class="flex-grow" />
        <p class="font-mono text-md-on-surface" style="font-size: 0.8rem">{{ totalTimeRemainingPretty }}</p>
      </div>
      <div class="w-full">
        <div class="h-1 w-full bg-track/50 relative rounded-full">
          <div ref="totalReadyTrack" class="h-full bg-track-buffered absolute top-0 left-0 pointer-events-none rounded-full" />
          <div ref="totalBufferedTrack" class="h-full bg-track absolute top-0 left-0 pointer-events-none rounded-full" />
          <div ref="totalPlayedTrack" class="h-full bg-track-cursor absolute top-0 left-0 pointer-events-none rounded-full" />
        </div>
      </div>
    </div>

    <div class="cover-wrapper absolute z-30 pointer-events-auto" @click="clickContainer">
      <div class="w-full h-full flex justify-center">
        <covers-book-cover v-if="libraryItem || localLibraryItemCoverSrc" ref="cover" :library-item="libraryItem" :download-cover="localLibraryItemCoverSrc" :width="bookCoverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" raw @imageLoaded="coverImageLoaded" />
      </div>

      <div v-if="syncStatus === SyncStatus.FAILED" class="absolute top-0 left-0 w-full h-full flex items-center justify-center z-30" @click.stop="showSyncsFailedDialog">
        <span class="material-symbols text-error text-3xl">error</span>
      </div>
    </div>

    <div class="title-author-texts absolute z-30 left-0 right-0 overflow-hidden" @click="clickTitleAndAuthor">
      <div ref="titlewrapper" class="overflow-hidden relative">
        <p class="title-text whitespace-nowrap"></p>
      </div>
      <p class="author-text text-md-on-surface/75 truncate">{{ authorName }}</p>
    </div>

    <div id="playerContent"
         class="playerContainer w-full z-20 absolute bottom-0 left-0 right-0 p-2 pointer-events-auto transition-all rounded-t-md-lg overflow-hidden"
         :class="{ 'bg-md-surface-4': !showFullscreen }"
         :style="showFullscreen ? { background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 60%, transparent 100%)' } : {}"
         @click="clickContainer">
      <div v-if="showFullscreen" class="absolute bottom-4 left-0 right-0 w-full pb-4 pt-2 mx-auto px-6" style="max-width: 414px">
        <div class="flex items-center justify-between pointer-events-auto">
          <span v-if="!isPodcast && serverLibraryItemId && socketConnected" class="material-symbols text-3xl text-md-on-surface-variant cursor-pointer" :class="{ fill: bookmarks.length }" @click="$emit('showBookmarks')">bookmark</span>
          <!-- hidden for podcasts but still using this as a placeholder -->
          <span v-else class="material-symbols text-3xl text-transparent">bookmark</span>

          <span class="font-mono text-md-on-surface-variant cursor-pointer" style="font-size: 1.35rem" @click="$emit('selectPlaybackSpeed')">{{ currentPlaybackRate }}x</span>
          <svg v-if="!sleepTimerRunning" xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-md-on-surface-variant cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor" @click.stop="$emit('showSleepTimer')">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <div v-else class="h-7 w-7 flex items-center justify-around cursor-pointer" @click.stop="$emit('showSleepTimer')">
            <p class="text-xl font-mono text-md-primary">{{ sleepTimeRemainingPretty }}</p>
          </div>

          <div class="flex items-center gap-3">
            <span
              class="material-symbols text-3xl text-md-on-surface cursor-pointer"
              :class="playQueueAvailable ? 'opacity-75' : 'opacity-10'"
              @click.stop="clickQueueBtn"
            >playlist_play</span>
            <span v-show="chapters.length > 0" class="material-symbols text-3xl text-md-on-surface-variant cursor-pointer" @click="clickChaptersBtn">format_list_bulleted</span>
          </div>
        </div>
      </div>
      <div v-else
           class="w-full h-full absolute top-0 left-0 pointer-events-none rounded-t-md-lg"
           :style="{ backgroundColor: coverRgb, opacity: 0.15 }" />

      <div id="playerControls" class="absolute right-0 bottom-0 mx-auto" style="max-width: 414px">
        <div class="flex items-center max-w-full" :class="playerSettings.lockUi ? 'justify-center' : 'justify-between'">
          <span v-show="showFullscreen && !playerSettings.lockUi" class="material-symbols next-icon text-md-on-surface cursor-pointer" :class="isLoading ? 'opacity-10' : 'opacity-75'" @click.stop="jumpChapterStart">first_page</span>
          <div v-show="!playerSettings.lockUi" class="jump-icon text-md-on-surface cursor-pointer flex flex-col items-center" :class="isLoading ? 'opacity-10' : 'opacity-75'" @click.stop="jumpBackwards">
            <span class="material-symbols text-3xl leading-none">replay</span>
            <span v-if="showFullscreen" class="jump-label text-[10px] font-semibold leading-tight">{{ jumpBackwardsLabel }}</span>
          </div>
          <div class="play-btn cursor-pointer shadow-sm flex items-center justify-center rounded-full text-primary mx-4 relative overflow-hidden" :style="{ backgroundColor: coverRgb }" :class="{ 'animate-spin': seekLoading }" @mousedown.prevent @mouseup.prevent @click.stop="playPauseClick">
            <div v-if="!coverBgIsLight" class="absolute top-0 left-0 w-full h-full bg-white/20 pointer-events-none" />

            <span v-if="!isLoading" class="material-symbols fill" :class="{ 'text-white': coverRgb && !coverBgIsLight }">{{ seekLoading ? 'autorenew' : !isPlaying ? 'play_arrow' : 'pause' }}</span>
            <widgets-spinner-icon v-else class="h-8 w-8" />
          </div>
          <div v-show="!playerSettings.lockUi" class="jump-icon text-md-on-surface cursor-pointer flex flex-col items-center" :class="isLoading ? 'opacity-10' : 'opacity-75'" @click.stop="jumpForward">
            <span class="material-symbols text-3xl leading-none">forward_media</span>
            <span v-if="showFullscreen" class="jump-label text-[10px] font-semibold leading-tight">{{ jumpForwardLabel }}</span>
          </div>
          <span v-show="showFullscreen && !playerSettings.lockUi" class="material-symbols next-icon text-md-on-surface cursor-pointer" :class="(nextChapter || nextQueueItem) && !isLoading ? 'opacity-75' : 'opacity-10'" @click.stop="jumpNextChapterOrQueue">last_page</span>
        </div>
      </div>

      <div id="playerTrack" class="absolute left-0 w-full px-6">
        <div class="flex pointer-events-none">
          <p class="font-mono text-md-on-surface" style="font-size: 0.8rem" ref="currentTimestamp">0:00</p>
          <div class="flex-grow" />
          <p class="font-mono text-md-on-surface" style="font-size: 0.8rem">{{ timeRemainingPretty }}</p>
        </div>
        <div ref="track" class="h-1.5 w-full bg-track/50 relative rounded-full" :class="{ 'animate-pulse': isLoading }" @click.stop>
          <div ref="readyTrack" class="h-full bg-track-buffered absolute top-0 left-0 rounded-full pointer-events-none" />
          <div ref="bufferedTrack" class="h-full bg-track absolute top-0 left-0 rounded-full pointer-events-none" />
          <div ref="playedTrack" class="h-full bg-track-cursor absolute top-0 left-0 rounded-full pointer-events-none" />
          <div ref="trackCursor" class="h-7 w-7 rounded-full absolute pointer-events-auto flex items-center justify-center" :style="{ top: '-11px' }" :class="{ 'opacity-0': playerSettings.lockUi || !showFullscreen }" @touchstart="touchstartCursor">
            <div class="bg-track-cursor rounded-full w-3.5 h-3.5 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>

    <modals-chapters-modal v-model="showChapterModal" :current-chapter="currentChapter" :chapters="chapters" :playback-rate="currentPlaybackRate" @select="selectChapter" />
    <modals-dialog v-model="showMoreMenuDialog" :items="menuItems" width="80vw" @action="clickMenuAction" />
  </div>
</template>

<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { AbsAudioPlayer } from '~/plugins/capacitor'
import { Dialog } from '@capacitor/dialog'
import { FastAverageColor } from 'fast-average-color'
import WrappingMarquee from '~/assets/WrappingMarquee.js'
import { SyncStatus, PlayMethod } from '~/constants'
import { getString } from '~/composables/useStrings'

// ── Stores & composables ──────────────────────────────────────────────────────
const appStore = useAppStore()
const globalsStore = useGlobalsStore()
const router = useRouter()
const platform = usePlatform()
const bus = useEventBus()
const { impact: hapticsImpact } = useHaptics()
const { secondsToTimestamp } = useUtils()
const localStore = useLocalStore()
const toast = useToast()
const { getJumpLabel } = useJumpLabel()

// ── Props ─────────────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  bookmarks?: unknown[]
  sleepTimerRunning?: boolean
  sleepTimeRemaining?: number
  serverLibraryItemId?: string | null
}>(), {
  bookmarks: () => [],
  sleepTimerRunning: false,
  sleepTimeRemaining: 0,
  serverLibraryItemId: null
})

// ── Emits ─────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  (e: 'showBookmarks'): void
  (e: 'selectPlaybackSpeed'): void
  (e: 'showSleepTimer'): void
  (e: 'showQueue'): void
  (e: 'skipNextQueue'): void
  (e: 'skipPreviousQueue'): void
  (e: 'updateTime', t: number): void
}>()

// ── Template refs ─────────────────────────────────────────────────────────────
const totalReadyTrack = ref<HTMLElement | null>(null)
const totalBufferedTrack = ref<HTMLElement | null>(null)
const totalPlayedTrack = ref<HTMLElement | null>(null)
const cover = ref<unknown | null>(null)
const titlewrapper = ref<HTMLElement | null>(null)
const currentTimestamp = ref<HTMLElement | null>(null)
const track = ref<HTMLElement | null>(null)
const readyTrack = ref<HTMLElement | null>(null)
const bufferedTrack = ref<HTMLElement | null>(null)
const playedTrack = ref<HTMLElement | null>(null)
const trackCursor = ref<HTMLElement | null>(null)

// ── Reactive state ────────────────────────────────────────────────────────────
const windowHeight = ref(0)
const windowWidth = ref(0)
const playbackSession = ref<Record<string, unknown> | null>(null)
const showChapterModal = ref(false)
const showFullscreen = ref(false)
const totalDuration = ref(0)
const currentPlaybackRate = ref(1)
const currentTime = ref(0)
const bufferedTime = ref(0)
const playInterval = ref<ReturnType<typeof setInterval> | null>(null)
const trackWidth = ref(0)
const isPlaying = ref(false)
const isEnded = ref(false)
const volume = ref(0.5)
const readyTrackWidth = ref(0)
const seekedTime = ref(0)
const seekLoading = ref(false)
const touchStartY = ref(0)
const touchStartTime = ref(0)
const playerSettings = ref({
  useChapterTrack: false,
  useTotalTrack: true,
  scaleElapsedTimeBySpeed: true,
  lockUi: false
})
const isLoading = ref(false)
const isDraggingCursor = ref(false)
const draggingTouchStartX = ref(0)
const draggingTouchStartTime = ref(0)
const draggingCurrentTime = ref(0)
const syncStatus = ref(0)
const showMoreMenuDialog = ref(false)
const coverRgb = ref('rgb(55, 56, 56)')
const coverBgIsLight = ref(false)
const titleMarquee = ref<InstanceType<typeof WrappingMarquee> | null>(null)
const lastNativeCurrentTime = ref<number | null>(null)
const isRefreshingUI = ref(false)
const appStateListener = ref<{ remove(): void } | null>(null)

// ── Computed ──────────────────────────────────────────────────────────────────
const playQueueAvailable = computed(() => Array.isArray(appStore.playQueue) && appStore.playQueue.length > 0)
const nextQueueItem = computed(() => appStore.getNextQueueItem)
const theme = computed(() => document.documentElement.dataset.theme || 'dark')

const menuItems = computed(() => {
  const items: { text: string; value: string; icon: string }[] = []
  // TODO: Implement on iOS
  if (platform !== 'ios' && !isPodcast.value && mediaId.value) {
    items.push({
      text: getString('ButtonHistory'),
      value: 'history',
      icon: 'history'
    })
  }

  items.push(
    ...[
      {
        text: getString('LabelTotalTrack'),
        value: 'total_track',
        icon: playerSettings.value.useTotalTrack ? 'check_box' : 'check_box_outline_blank'
      },
      {
        text: getString('LabelChapterTrack'),
        value: 'chapter_track',
        icon: playerSettings.value.useChapterTrack ? 'check_box' : 'check_box_outline_blank'
      },
      {
        text: getString('LabelScaleElapsedTimeBySpeed'),
        value: 'scale_elapsed_time',
        icon: playerSettings.value.scaleElapsedTimeBySpeed ? 'check_box' : 'check_box_outline_blank'
      },
      {
        text: playerSettings.value.lockUi ? getString('LabelUnlockPlayer') : getString('LabelLockPlayer'),
        value: 'lock',
        icon: playerSettings.value.lockUi ? 'lock' : 'lock_open'
      },
      {
        text: getString('LabelClosePlayer'),
        value: 'close',
        icon: 'close'
      }
    ]
  )

  return items
})

const jumpForwardTime = computed(() => appStore.getJumpForwardTime)
const jumpBackwardsTime = computed(() => appStore.getJumpBackwardsTime)
const jumpForwardLabel = computed(() => getJumpLabel(jumpForwardTime.value))
const jumpBackwardsLabel = computed(() => getJumpLabel(jumpBackwardsTime.value))

const bookCoverAspectRatio = computed(() => globalsStore.getBookCoverAspectRatio)

const fullscreenBookCoverWidth = computed(() => {
  if (windowWidth.value < windowHeight.value) {
    // Portrait
    let sideSpace = 20
    if (bookCoverAspectRatio.value === 1.6) sideSpace += (windowWidth.value - sideSpace) * 0.375

    const availableHeight = windowHeight.value - 400
    let width = windowWidth.value - sideSpace
    const totalHeight = width * bookCoverAspectRatio.value
    if (totalHeight > availableHeight) {
      width = availableHeight / bookCoverAspectRatio.value
    }
    return width
  } else {
    // Landscape: cover becomes square (CSS uses --cover-image-height for both dimensions).
    // Compute width so that coverHeight = width * aspectRatio fits in the left column.
    const maxSquareSize = Math.min(windowHeight.value * 0.65, windowWidth.value * 0.38)
    return maxSquareSize / bookCoverAspectRatio.value
  }
})

const bookCoverWidth = computed(() => {
  if (showFullscreen.value) return fullscreenBookCoverWidth.value
  return 46 / bookCoverAspectRatio.value
})

const showCastBtn = computed(() => appStore.isCastEnabled || appStore.isCasting)
const castAvailable = computed(() => appStore.isCastAvailable)
const isCasting = computed(() => mediaPlayer.value === 'cast-player')
const mediaPlayer = computed(() => (playbackSession.value?.mediaPlayer as string) || null)
const mediaType = computed(() => (playbackSession.value?.mediaType as string) || null)
const isPodcast = computed(() => mediaType.value === 'podcast')
const mediaMetadata = computed(() => (playbackSession.value?.mediaMetadata as Record<string, unknown>) || null)
const libraryItem = computed(() => (playbackSession.value?.libraryItem as Record<string, unknown>) || null)
const localLibraryItem = computed(() => (playbackSession.value?.localLibraryItem as Record<string, unknown>) || null)

const localLibraryItemCoverSrc = computed(() => {
  const localItemCover = (localLibraryItem.value?.coverContentUrl as string) || null
  if (localItemCover) return Capacitor.convertFileSrc(localItemCover)
  return null
})

const playMethod = computed(() => (playbackSession.value?.playMethod as number) || 0)
const isLocalPlayMethod = computed(() => playMethod.value == PlayMethod.LOCAL)
const isDirectPlayMethod = computed(() => playMethod.value == PlayMethod.DIRECTPLAY)

const currentChapter = computed(() => {
  if (!chapters.value.length) return null
  return chapters.value.find((ch: Record<string, unknown>) => Number(Number(ch.start).toFixed(2)) <= currentTime.value && Number(Number(ch.end).toFixed(2)) > currentTime.value) ?? null
})

const nextChapter = computed(() => {
  if (!chapters.value.length) return undefined
  return chapters.value.find((c: Record<string, unknown>) => Number(Number(c.start).toFixed(2)) > currentTime.value)
})

const currentChapterTitle = computed(() => (currentChapter.value?.title as string) || '')

const title = computed(() => {
  const mediaItemTitle = (playbackSession.value?.displayTitle as string) || (mediaMetadata.value?.title as string) || 'Title'
  if (currentChapterTitle.value) {
    if (showFullscreen.value) return currentChapterTitle.value
    return `${mediaItemTitle} | ${currentChapterTitle.value}`
  }
  return mediaItemTitle
})

const authorName = computed(() => {
  if (playbackSession.value) return (playbackSession.value.displayAuthor as string) || ''
  return (mediaMetadata.value?.authorName as string) || 'Author'
})

const chapters = computed(() => (playbackSession.value?.chapters as Record<string, unknown>[]) || [])

const currentChapterDuration = computed(() => {
  if (currentChapter.value) {
    return (currentChapter.value.end as number) - (currentChapter.value.start as number)
  }
  return totalDuration.value
})

const totalDurationPretty = computed(() => secondsToTimestamp(totalDuration.value))

const currentTimePretty = computed(() => {
  let currentTimeToUse = isDraggingCursor.value ? draggingCurrentTime.value : currentTime.value
  if (playerSettings.value.scaleElapsedTimeBySpeed) {
    currentTimeToUse = currentTimeToUse / currentPlaybackRate.value
  }
  return secondsToTimestamp(currentTimeToUse)
})

const totalTimeRemaining = computed(() => {
  const currentTimeToUse = isDraggingCursor.value ? draggingCurrentTime.value : currentTime.value
  return (totalDuration.value - currentTimeToUse) / currentPlaybackRate.value
})

const timeRemaining = computed(() => {
  const currentTimeToUse = isDraggingCursor.value ? draggingCurrentTime.value : currentTime.value
  if (playerSettings.value.useChapterTrack && currentChapter.value) {
    const currChapTime = currentTimeToUse - (currentChapter.value.start as number)
    return (currentChapterDuration.value - currChapTime) / currentPlaybackRate.value
  }
  return totalTimeRemaining.value
})

const totalTimeRemainingPretty = computed(() => {
  if (totalTimeRemaining.value < 0) {
    return secondsToTimestamp(totalTimeRemaining.value * -1)
  }
  return '-' + secondsToTimestamp(totalTimeRemaining.value)
})

const timeRemainingPretty = computed(() => {
  if (timeRemaining.value < 0) {
    return secondsToTimestamp(timeRemaining.value * -1)
  }
  return '-' + secondsToTimestamp(timeRemaining.value)
})

const sleepTimeRemainingPretty = computed(() => {
  if (!props.sleepTimeRemaining) return '0s'
  const secondsRemaining = Math.round(props.sleepTimeRemaining)
  if (secondsRemaining > 91) {
    return Math.ceil(secondsRemaining / 60) + 'm'
  } else {
    return secondsRemaining + 's'
  }
})

const socketConnected = computed(() => appStore.socketConnected)

const mediaId = computed(() => {
  if (isPodcast.value || !playbackSession.value) return null
  const session = playbackSession.value
  if (session.libraryItemId) {
    return session.episodeId ? `${session.libraryItemId}-${session.episodeId}` : session.libraryItemId as string
  }
  const lli = session.localLibraryItem as Record<string, unknown> | null
  if (!lli) return null
  return session.localEpisodeId ? `${lli.id}-${session.localEpisodeId}` : lli.id as string
})

// ── Watchers ──────────────────────────────────────────────────────────────────
watch(showFullscreen, (val) => {
  updateScreenSize()
  appStore.playerIsFullscreen = !!val
  const bodyEl = document.querySelector('body') as HTMLElement
  bodyEl.style.backgroundColor = showFullscreen.value ? coverRgb.value : ''
})

watch(() => appStore.currentPlaybackSession, (val) => {
  if (!val) {
    playbackSession.value = null
    return
  }

  if (!playbackSession.value || (playbackSession.value as Record<string, unknown>).id !== (val as Record<string, unknown>).id) {
    // Initialize the player UI when a session is restored or changed
    // so metadata like title and cover image are populated correctly.
    // Skip loading state so the play button stays interactive.
    onPlaybackSession(val as unknown as Record<string, unknown>, { isLoading: false })
  }

  totalDuration.value = Number(((val as Record<string, unknown>).duration as number || 0).toFixed(2))
  currentTime.value = Number(((val as Record<string, unknown>).currentTime as number || 0).toFixed(2))
  timeupdate()
})

watch(() => appStore.playerIsPlaying, async (isPlayingVal) => {
  isPlaying.value = isPlayingVal
  if (isPlayingVal) {
    await refreshCurrentPlaybackPosition()
    startPlayInterval()
  } else {
    stopPlayInterval()
  }
})

watch(bookCoverAspectRatio, () => {
  updateScreenSize()
})

watch(title, (val) => {
  if (titleMarquee.value) titleMarquee.value.init(val)
})

// ── Methods ───────────────────────────────────────────────────────────────────
function showSyncsFailedDialog() {
  Dialog.alert({
    title: getString('HeaderProgressSyncFailed'),
    message: getString('MessageProgressSyncFailed'),
    buttonTitle: getString('ButtonOk')
  })
}

function clickQueueBtn() {
  if (!playQueueAvailable.value) return
  emit('showQueue')
}

function clickChaptersBtn() {
  if (!chapters.value.length) return
  showChapterModal.value = true
}

async function coverImageLoaded(fullCoverUrl: string) {
  if (!fullCoverUrl) return

  const fac = new FastAverageColor()
  fac
    .getColorAsync(fullCoverUrl)
    .then((color) => {
      coverRgb.value = color.rgba
      coverBgIsLight.value = color.isLight
    })
    .catch((e) => {
      console.log(e)
    })
}

function clickTitleAndAuthor() {
  if (!showFullscreen.value) return
  const llid = props.serverLibraryItemId || (libraryItem.value?.id as string) || (localLibraryItem.value?.id as string)
  if (llid) {
    router.push(`/item/${llid}`)
    showFullscreen.value = false
  }
}

async function selectChapter(chapter: Record<string, unknown>) {
  await hapticsImpact()
  seek(chapter.start as number)
  showChapterModal.value = false
}

async function castClick() {
  await hapticsImpact()
  if (isLocalPlayMethod.value) {
    bus.emit('cast-local-item', undefined)
    return
  }
  AbsAudioPlayer.requestSession()
}

function clickContainer() {
  expandToFullscreen()
}

function expandToFullscreen() {
  showFullscreen.value = true
  if (titleMarquee.value) titleMarquee.value.reset()

  // Update track for total time bar if useChapterTrack is set
  nextTick(() => {
    updateTrack()
  })
}

function collapseFullscreen() {
  showFullscreen.value = false
  if (titleMarquee.value) titleMarquee.value.reset()

  forceCloseDropdownMenu()
}

async function jumpNextChapter() {
  await hapticsImpact()
  if (isLoading.value) return
  if (!nextChapter.value) return
  seek((nextChapter.value as Record<string, unknown>).start as number)
}

async function jumpNextChapterOrQueue() {
  await hapticsImpact()
  if (isLoading.value) return
  if (nextChapter.value) {
    seek((nextChapter.value as Record<string, unknown>).start as number)
  } else if (nextQueueItem.value) {
    emit('skipNextQueue')
  }
}

async function jumpChapterStart() {
  await hapticsImpact()
  if (isLoading.value) return
  if (!currentChapter.value) {
    return restart()
  }

  // If 4 seconds or less into current chapter, then go to previous
  if (currentTime.value - (currentChapter.value.start as number) <= 4) {
    const currChapterIndex = chapters.value.findIndex((ch: Record<string, unknown>) => Number(ch.start) <= currentTime.value && Number(ch.end) >= currentTime.value)
    if (currChapterIndex > 0) {
      const prevChapter = chapters.value[currChapterIndex - 1]
      seek(prevChapter.start as number)
    }
  } else {
    seek(currentChapter.value.start as number)
  }
}

function showSleepTimerModal() {
  emit('showSleepTimer')
}

async function setPlaybackSpeed(speed: number) {
  console.log(`[AudioPlayer] Set Playback Rate: ${speed}`)
  currentPlaybackRate.value = speed
  updateTimestamp()
  AbsAudioPlayer.setPlaybackSpeed({ value: speed })
}

function restart() {
  seek(0)
}

async function jumpBackwards() {
  await hapticsImpact()
  if (isLoading.value) return
  AbsAudioPlayer.seekBackward({ value: jumpBackwardsTime.value })
}

async function jumpForward() {
  await hapticsImpact()
  if (isLoading.value) return
  AbsAudioPlayer.seekForward({ value: jumpForwardTime.value })
}

function setStreamReady() {
  readyTrackWidth.value = trackWidth.value
  updateReadyTrack()
}

function setChunksReady(chunks: (string | number)[], numSegments: number) {
  let largestSeg = 0
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    if (typeof chunk === 'string') {
      const chunkRange = chunk.split('-').map((c) => Number(c))
      if (chunkRange.length < 2) continue
      if (chunkRange[1] > largestSeg) largestSeg = chunkRange[1]
    } else if (chunk > largestSeg) {
      largestSeg = chunk
    }
  }
  const percentageReady = largestSeg / numSegments
  const widthReady = Math.round(trackWidth.value * percentageReady)
  if (readyTrackWidth.value === widthReady) {
    return
  }
  readyTrackWidth.value = widthReady
  updateReadyTrack()
}

function updateReadyTrack() {
  if (playerSettings.value.useChapterTrack) {
    if (totalReadyTrack.value) {
      totalReadyTrack.value.style.width = readyTrackWidth.value + 'px'
    }
    if (readyTrack.value) readyTrack.value.style.width = trackWidth.value + 'px'
  } else {
    if (readyTrack.value) readyTrack.value.style.width = readyTrackWidth.value + 'px'
  }
}

function updateTimestamp() {
  const ts = currentTimestamp.value
  if (!ts) {
    console.error('No timestamp el')
    return
  }

  let ct = isDraggingCursor.value ? draggingCurrentTime.value : currentTime.value
  if (playerSettings.value.useChapterTrack && currentChapter.value) {
    ct = Math.max(0, ct - (currentChapter.value.start as number))
  }
  if (playerSettings.value.scaleElapsedTimeBySpeed) {
    ct = ct / currentPlaybackRate.value
  }

  ts.innerText = secondsToTimestamp(ct)
}

function timeupdate() {
  if (!playedTrack.value) {
    console.error('Invalid no played track ref')
    return
  }
  emit('updateTime', currentTime.value)

  if (seekLoading.value) {
    seekLoading.value = false
    if (playedTrack.value) {
      playedTrack.value.classList.remove('bg-yellow-300')
      playedTrack.value.classList.add('bg-gray-200')
    }
  }

  updateTimestamp()
  updateTrack()
}

function updateTrack() {
  // Update progress track UI
  let currentTimeToUse = isDraggingCursor.value ? draggingCurrentTime.value : currentTime.value
  let percentDone = currentTimeToUse / totalDuration.value
  const totalPercentDone = percentDone
  let bufferedPercent = bufferedTime.value / totalDuration.value
  const totalBufferedPercent = bufferedPercent

  if (playerSettings.value.useChapterTrack && currentChapter.value) {
    const currChapTime = currentTimeToUse - (currentChapter.value.start as number)
    percentDone = currChapTime / currentChapterDuration.value
    bufferedPercent = Math.max(0, Math.min(1, (bufferedTime.value - (currentChapter.value.start as number)) / currentChapterDuration.value))
  }

  const ptWidth = Math.round(percentDone * trackWidth.value)
  if (playedTrack.value) {
    playedTrack.value.style.width = ptWidth + 'px'
  }
  if (bufferedTrack.value) {
    bufferedTrack.value.style.width = Math.round(bufferedPercent * trackWidth.value) + 'px'
  }

  if (trackCursor.value) {
    trackCursor.value.style.left = ptWidth - 14 + 'px'
  }

  if (playerSettings.value.useChapterTrack) {
    if (totalPlayedTrack.value) totalPlayedTrack.value.style.width = Math.round(totalPercentDone * trackWidth.value) + 'px'
    if (totalBufferedTrack.value) totalBufferedTrack.value.style.width = Math.round(totalBufferedPercent * trackWidth.value) + 'px'
  }
}

function seek(time: number) {
  if (isLoading.value) return
  if (seekLoading.value) {
    console.error('Already seek loading', seekedTime.value)
    return
  }

  seekedTime.value = time
  seekLoading.value = true

  AbsAudioPlayer.seek({ value: Math.floor(time) })

  if (playedTrack.value) {
    const perc = time / totalDuration.value
    const ptWidth = Math.round(perc * trackWidth.value)
    playedTrack.value.style.width = ptWidth + 'px'

    playedTrack.value.classList.remove('bg-gray-200')
    playedTrack.value.classList.add('bg-yellow-300')
  }
}

async function touchstartCursor(e: TouchEvent) {
  if (!e || !e.touches || !track.value || !showFullscreen.value || playerSettings.value.lockUi) return

  await hapticsImpact()
  isDraggingCursor.value = true
  draggingTouchStartX.value = e.touches[0].pageX
  draggingTouchStartTime.value = currentTime.value
  draggingCurrentTime.value = currentTime.value
  updateTrack()
}

async function playPauseClick() {
  await hapticsImpact()
  if (isLoading.value) return

  isPlaying.value = !!((await AbsAudioPlayer.playPause()) || {}).playing
  isEnded.value = false
}

function play() {
  AbsAudioPlayer.playPlayer()
  startPlayInterval()
  isPlaying.value = true
}

function pause() {
  AbsAudioPlayer.pausePlayer()
  stopPlayInterval()
  isPlaying.value = false
}

function startPlayInterval() {
  clearInterval(playInterval.value ?? undefined)
  playInterval.value = setInterval(async () => {
    const data = await AbsAudioPlayer.getCurrentTime()
    currentTime.value = Number(data.value.toFixed(2))
    bufferedTime.value = Number(data.bufferedTime.toFixed(2))
    timeupdate()
  }, 1000)
}

function stopPlayInterval() {
  clearInterval(playInterval.value ?? undefined)
  playInterval.value = null
}

function resetStream(_startTime: number) {
  closePlayback()
}

function touchstart(e: TouchEvent) {
  if (!e.changedTouches || globalsStore.isModalOpen) return
  const touchPosY = e.changedTouches[0].pageY
  // when minimized only listen to touchstart on the player
  if (!showFullscreen.value && touchPosY < window.innerHeight - 120) return

  // for ios
  if (!showFullscreen.value && (e as unknown as { pageX: number }).pageX < 20) {
    e.preventDefault()
    e.stopImmediatePropagation()
  }

  touchStartY.value = touchPosY
  touchStartTime.value = Date.now()
}

function touchend(e: TouchEvent) {
  if (!e.changedTouches) return
  const touchDuration = Date.now() - touchStartTime.value
  const touchEndY = e.changedTouches[0].pageY
  const touchDistanceY = touchEndY - touchStartY.value

  // reset touch start data
  touchStartTime.value = 0
  touchStartY.value = 0

  if (isDraggingCursor.value) {
    if (draggingCurrentTime.value !== currentTime.value) {
      seek(draggingCurrentTime.value)
    }
    isDraggingCursor.value = false
  } else {
    if (touchDuration > 1200) {
      return
    }
    if (showFullscreen.value) {
      // Touch start higher than touchend
      if (touchDistanceY > 100) {
        collapseFullscreen()
      }
    } else if (touchDistanceY < -100) {
      expandToFullscreen()
    }
  }
}

function touchmove(e: TouchEvent) {
  if (!isDraggingCursor.value || !e.touches) return

  const distanceMoved = e.touches[0].pageX - draggingTouchStartX.value
  let duration = totalDuration.value
  let minTime = 0
  let maxTime = duration
  if (playerSettings.value.useChapterTrack && currentChapter.value) {
    duration = currentChapterDuration.value
    minTime = currentChapter.value.start as number
    maxTime = minTime + duration
  }

  const timePerPixel = duration / trackWidth.value
  const newTime = draggingTouchStartTime.value + timePerPixel * distanceMoved
  draggingCurrentTime.value = Math.min(maxTime, Math.max(minTime, newTime))

  updateTimestamp()
  updateTrack()
}

async function clickMenuAction(action: string) {
  await hapticsImpact()
  showMoreMenuDialog.value = false
  nextTick(() => {
    if (action === 'history') {
      router.push(`/media/${mediaId.value}/history?title=${title.value}`)
      showFullscreen.value = false
    } else if (action === 'scale_elapsed_time') {
      playerSettings.value.scaleElapsedTimeBySpeed = !playerSettings.value.scaleElapsedTimeBySpeed
      updateTimestamp()
      savePlayerSettings()
    } else if (action === 'lock') {
      playerSettings.value.lockUi = !playerSettings.value.lockUi
      savePlayerSettings()
    } else if (action === 'chapter_track') {
      playerSettings.value.useChapterTrack = !playerSettings.value.useChapterTrack
      playerSettings.value.useTotalTrack = !playerSettings.value.useChapterTrack || playerSettings.value.useTotalTrack

      updateTimestamp()
      updateTrack()
      updateReadyTrack()
      updateUseChapterTrack()
      savePlayerSettings()
    } else if (action === 'total_track') {
      playerSettings.value.useTotalTrack = !playerSettings.value.useTotalTrack
      playerSettings.value.useChapterTrack = !playerSettings.value.useTotalTrack || playerSettings.value.useChapterTrack

      updateTimestamp()
      updateTrack()
      updateReadyTrack()
      updateUseChapterTrack()
      savePlayerSettings()
    } else if (action === 'close') {
      closePlayback()
    }
  })
}

function updateUseChapterTrack() {
  // Chapter track in NowPlaying only supported on iOS for now
  if (platform === 'ios') {
    AbsAudioPlayer.setChapterTrack({ enabled: playerSettings.value.useChapterTrack })
  }
}

function forceCloseDropdownMenu() {
  // no-op: dropdownMenu ref not used in this template
}

function closePlayback() {
  endPlayback()
  AbsAudioPlayer.closePlayback()
}

function endPlayback() {
  appStore.setPlaybackSession(null)
  showFullscreen.value = false
  isEnded.value = false
  isLoading.value = false
  playbackSession.value = null
  lastNativeCurrentTime.value = null
}

async function loadPlayerSettings() {
  const savedPlayerSettings = await localStore.getPlayerSettings()
  if (!savedPlayerSettings) {
    // In 0.9.72-beta 'useChapterTrack', 'useTotalTrack' and 'playerLock' was replaced with 'playerSettings' JSON object
    // Check if this old key was set and if so migrate them over to 'playerSettings'
    const chapterTrackPref = await localStore.getPreferenceByKey('useChapterTrack')
    if (chapterTrackPref) {
      playerSettings.value.useChapterTrack = chapterTrackPref === '1'
      const totalTrackPref = await localStore.getPreferenceByKey('useTotalTrack')
      playerSettings.value.useTotalTrack = totalTrackPref === '1'
      const playerLockPref = await localStore.getPreferenceByKey('playerLock')
      playerSettings.value.lockUi = playerLockPref === '1'
    }
    savePlayerSettings()
  } else {
    playerSettings.value.useChapterTrack = !!savedPlayerSettings.useChapterTrack
    playerSettings.value.useTotalTrack = !!savedPlayerSettings.useTotalTrack
    playerSettings.value.lockUi = !!savedPlayerSettings.lockUi
    playerSettings.value.scaleElapsedTimeBySpeed = !!savedPlayerSettings.scaleElapsedTimeBySpeed
  }
}

function savePlayerSettings() {
  return localStore.setPlayerSettings({ ...playerSettings.value })
}

//
// Listeners from audio AbsAudioPlayer
//
function onPlayingUpdate(data: { value: boolean }) {
  console.log('onPlayingUpdate', JSON.stringify(data))
  isPlaying.value = !!data.value
  appStore.playerIsPlaying = isPlaying.value
  if (isPlaying.value) {
    startPlayInterval()
  } else {
    stopPlayInterval()
  }
}

function onMetadata(data: { duration: number; currentTime: number; playerState: string }) {
  console.log('onMetadata', JSON.stringify(data))
  totalDuration.value = Number(data.duration.toFixed(2))
  currentTime.value = Number(data.currentTime.toFixed(2))

  // Done loading
  if (data.playerState !== 'BUFFERING' && data.playerState !== 'IDLE') {
    isLoading.value = false
  }

  if (data.playerState === 'ENDED') {
    console.log('[AudioPlayer] Playback ended')
  }
  isEnded.value = data.playerState === 'ENDED'

  console.log('received metadata update', data)

  timeupdate()
}

// When a playback session is started the native android/ios will send the session
function onPlaybackSession(ps: Record<string, unknown>, opts?: { isLoading?: boolean }) {
  console.log('onPlaybackSession received', JSON.stringify(ps))
  const isResync = !!(playbackSession.value && (playbackSession.value as Record<string, unknown>).id === ps.id)
  playbackSession.value = ps

  isEnded.value = false
  // Don't flash the loading spinner when the same session is resent on app resume
  isLoading.value = isResync ? false : (opts?.isLoading !== undefined ? opts.isLoading : true)
  syncStatus.value = 0
  lastNativeCurrentTime.value = null
  appStore.setPlaybackSession(ps as unknown as import('~/types').PlaybackSession)

  // Set track width
  nextTick(() => {
    if (titleMarquee.value) titleMarquee.value.reset()
    if (titlewrapper.value) {
      titleMarquee.value = new WrappingMarquee(titlewrapper.value)
      titleMarquee.value.init(title.value)
    }

    if (track.value) {
      trackWidth.value = track.value.clientWidth
    } else {
      console.error('Track not loaded')
    }
  })
}

function onPlaybackClosed() {
  endPlayback()
}

function onPlaybackFailed(data: { value?: string }) {
  console.log('Received onPlaybackFailed evt')
  const errorMessage = data.value || 'Unknown Error'
  toast.error(`Playback Failed: ${errorMessage}`)
  endPlayback()
}

function onPlaybackSpeedChanged(data: { value?: number }) {
  if (!data.value || isNaN(data.value)) return
  currentPlaybackRate.value = Number(data.value)
  updateTimestamp()
}

async function init() {
  await loadPlayerSettings()

  AbsAudioPlayer.addListener('onPlaybackSession', onPlaybackSession as unknown as Parameters<typeof AbsAudioPlayer.addListener>[1])
  AbsAudioPlayer.addListener('onPlaybackClosed', onPlaybackClosed as unknown as Parameters<typeof AbsAudioPlayer.addListener>[1])
  AbsAudioPlayer.addListener('onPlaybackFailed', onPlaybackFailed as unknown as Parameters<typeof AbsAudioPlayer.addListener>[1])
  AbsAudioPlayer.addListener('onPlayingUpdate', onPlayingUpdate as unknown as Parameters<typeof AbsAudioPlayer.addListener>[1])
  AbsAudioPlayer.addListener('onMetadata', onMetadata as unknown as Parameters<typeof AbsAudioPlayer.addListener>[1])
  AbsAudioPlayer.addListener('onProgressSyncFailing', showProgressSyncIsFailing as unknown as Parameters<typeof AbsAudioPlayer.addListener>[1])
  AbsAudioPlayer.addListener('onProgressSyncSuccess', showProgressSyncSuccess as unknown as Parameters<typeof AbsAudioPlayer.addListener>[1])
  AbsAudioPlayer.addListener('onPlaybackSpeedChanged', onPlaybackSpeedChanged as unknown as Parameters<typeof AbsAudioPlayer.addListener>[1])
}

async function screenOrientationChange() {
  if (isRefreshingUI.value) return
  isRefreshingUI.value = true
  const windowWidthSnap = window.innerWidth
  refreshUI()

  // Window width does not always change right away. Wait up to 250ms for a change.
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    if (window.innerWidth !== windowWidthSnap) {
      refreshUI()
      break
    }
  }

  isRefreshingUI.value = false
}

function refreshUI() {
  updateScreenSize()
  if (track.value) {
    trackWidth.value = track.value.clientWidth
    updateTrack()
    updateReadyTrack()
  }
}

function updateScreenSize() {
  setTimeout(() => {
    if (titleMarquee.value) titleMarquee.value.init(title.value)
  }, 500)

  windowHeight.value = window.innerHeight
  windowWidth.value = window.innerWidth
  const coverHeight = fullscreenBookCoverWidth.value * bookCoverAspectRatio.value
  const coverImageWidthCollapsed = 46 / bookCoverAspectRatio.value
  const titleAuthorLeftOffsetCollapsed = 30 + coverImageWidthCollapsed
  const titleAuthorWidthCollapsed = windowWidth.value - 128 - titleAuthorLeftOffsetCollapsed - 10

  document.documentElement.style.setProperty('--cover-image-width', fullscreenBookCoverWidth.value + 'px')
  document.documentElement.style.setProperty('--cover-image-height', coverHeight + 'px')
  document.documentElement.style.setProperty('--cover-image-width-collapsed', coverImageWidthCollapsed + 'px')
  document.documentElement.style.setProperty('--cover-image-height-collapsed', 46 + 'px')
  document.documentElement.style.setProperty('--title-author-left-offset-collapsed', titleAuthorLeftOffsetCollapsed + 'px')
  document.documentElement.style.setProperty('--title-author-width-collapsed', titleAuthorWidthCollapsed + 'px')
}

function minimizePlayerEvt() {
  collapseFullscreen()
}

function showProgressSyncIsFailing() {
  syncStatus.value = SyncStatus.FAILED
}

function showProgressSyncSuccess() {
  syncStatus.value = SyncStatus.SUCCESS
}

async function registerAppStateListener() {
  if (!Capacitor?.isPluginAvailable || !Capacitor.isPluginAvailable('App')) return
  try {
    appStateListener.value = await App.addListener('appStateChange', onAppStateChange)
  } catch (error) {
    console.error('[AudioPlayer] Failed to register app state listener', error)
  }
}

async function onAppStateChange(state: { isActive: boolean }) {
  if (!state) return
  if (state.isActive) {
    await refreshCurrentPlaybackPosition()
    maybeRestartPolling()
  } else {
    stopPlayInterval()
  }
}

async function refreshCurrentPlaybackPosition() {
  if (!playbackSession.value || typeof AbsAudioPlayer?.getCurrentTime !== 'function') return
  try {
    const previousNativeTime =
      typeof lastNativeCurrentTime.value === 'number' ? lastNativeCurrentTime.value : null
    const data = await AbsAudioPlayer.getCurrentTime()
    if (!data) return

    const rawCurrentTime = typeof data.value === 'number' ? data.value : null

    if (rawCurrentTime !== null) {
      lastNativeCurrentTime.value = rawCurrentTime
      currentTime.value = Number(rawCurrentTime.toFixed(2))
    }
    if (typeof data.bufferedTime === 'number') {
      bufferedTime.value = Number(data.bufferedTime.toFixed(2))
    }

    if (playedTrack.value) {
      timeupdate()
    } else {
      updateTimestamp()
    }

    const observedChange =
      previousNativeTime !== null && rawCurrentTime !== null ? rawCurrentTime - previousNativeTime : 0
    const resumedProgress = observedChange > 0.25

    let nativePlaybackState: boolean | null = resumedProgress ? true : null
    if (!resumedProgress && !isPlaying.value && !appStore.playerIsPlaying) {
      nativePlaybackState = await determineNativePlaybackState(rawCurrentTime)
    }

    if (nativePlaybackState === true) {
      isPlaying.value = true
      if (!appStore.playerIsPlaying) {
        appStore.playerIsPlaying = true
      }
      startPlayInterval()
    } else if (nativePlaybackState === false) {
      isPlaying.value = false
      if (appStore.playerIsPlaying) {
        appStore.playerIsPlaying = false
      }
      stopPlayInterval()
    } else {
      if (observedChange > 0.05) {
        isPlaying.value = true
        if (!appStore.playerIsPlaying) {
          appStore.playerIsPlaying = true
        }
        startPlayInterval()
      } else {
        maybeRestartPolling()
      }
    }
  } catch (error) {
    console.error('[AudioPlayer] Failed to refresh playback position', error)
  }
}

function maybeRestartPolling() {
  if (platform === 'web') return
  if (!isPlaying.value && !appStore.playerIsPlaying) return
  startPlayInterval()
}

async function determineNativePlaybackState(baselineTime: number | null): Promise<boolean | null> {
  if (platform === 'web') return null
  if (typeof baselineTime !== 'number') return null
  if (typeof AbsAudioPlayer?.getCurrentTime !== 'function') return null

  try {
    await new Promise((resolve) => setTimeout(resolve, 750))
    if (!playbackSession.value) return null
    const followUp = await AbsAudioPlayer.getCurrentTime()
    if (!followUp || typeof followUp.value !== 'number') return null
    const followUpTime = followUp.value
    return followUpTime - baselineTime > 0.1
  } catch (error) {
    console.error('[AudioPlayer] Failed to evaluate native playback state', error)
    return null
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  updateScreenSize()
  if (screen.orientation) {
    // Not available on ios
    screen.orientation.addEventListener('change', screenOrientationChange)
  } else {
    document.addEventListener('orientationchange', screenOrientationChange)
  }
  window.addEventListener('resize', screenOrientationChange)

  registerAppStateListener()

  bus.on('minimize-player', minimizePlayerEvt)
  document.body.addEventListener('touchstart', touchstart, { passive: false })
  document.body.addEventListener('touchend', touchend)
  document.body.addEventListener('touchmove', touchmove)
  nextTick(async () => {
    await init()
    const saved = appStore.currentPlaybackSession
    if (saved) {
      onPlaybackSession(saved as unknown as Record<string, unknown>, { isLoading: false })
      await refreshCurrentPlaybackPosition()
      if (appStore.playerIsPlaying) {
        startPlayInterval()
      }
    }
  })
})

onBeforeUnmount(() => {
  if (screen.orientation) {
    // Not available on ios
    screen.orientation.removeEventListener('change', screenOrientationChange)
  } else {
    document.removeEventListener('orientationchange', screenOrientationChange)
  }
  window.removeEventListener('resize', screenOrientationChange)

  if (playbackSession.value) {
    console.log('[AudioPlayer] Before destroy closing playback')
    closePlayback()
  }

  forceCloseDropdownMenu()
  bus.off('minimize-player', minimizePlayerEvt)
  document.body.removeEventListener('touchstart', touchstart)
  document.body.removeEventListener('touchend', touchend)
  document.body.removeEventListener('touchmove', touchmove)

  if (AbsAudioPlayer.removeAllListeners) {
    AbsAudioPlayer.removeAllListeners()
  }
  clearInterval(playInterval.value ?? undefined)
  if (appStateListener.value?.remove) {
    appStateListener.value.remove()
    appStateListener.value = null
  }
})

// ── Expose public interface ───────────────────────────────────────────────────
const audioPlayerReady = computed(() => true)
defineExpose({ audioPlayerReady, streamOpen: onPlaybackSession, setPlaybackSpeed, setStreamReady, setChunksReady, currentPlaybackRate })
</script>

<style>
:root {
  --cover-image-width: 0px;
  --cover-image-height: 0px;
  --cover-image-width-collapsed: 46px;
  --cover-image-height-collapsed: 46px;
  --title-author-left-offset-collapsed: 80px;
  --title-author-width-collapsed: 40%;
}

.playerContainer {
  height: 120px;
}
.fullscreen .playerContainer {
  height: 200px;
}
#playerContent {
  box-shadow: 0px -8px 8px #11111155;
}
.fullscreen #playerContent {
  box-shadow: none;
}

#playerTrack {
  transition: all 0.15s cubic-bezier(0.39, 0.575, 0.565, 1);
  transition-property: margin;
  bottom: 35px;
}
.fullscreen #playerTrack {
  bottom: 22px;
}

.cover-wrapper {
  bottom: 68px;
  left: 24px;
  height: var(--cover-image-height-collapsed);
  width: var(--cover-image-width-collapsed);
  transition: all 0.25s cubic-bezier(0.39, 0.575, 0.565, 1);
  transition-property: left, bottom, width, height;
  transform-origin: left bottom;
  border-radius: 3px;
  overflow: hidden;
}

.total-track {
  bottom: 215px;
  left: 0;
  right: 0;
}

.title-author-texts {
  transition: all 0.15s cubic-bezier(0.39, 0.575, 0.565, 1);
  transition-property: left, bottom, width, height;
  transform-origin: left bottom;

  width: var(--title-author-width-collapsed);
  bottom: 76px;
  left: var(--title-author-left-offset-collapsed);
  text-align: left;
}
.title-author-texts .title-text {
  transition: all 0.15s cubic-bezier(0.39, 0.575, 0.565, 1);
  transition-property: font-size;
  font-size: 0.85rem;
  line-height: 1.5;
}
.title-author-texts .author-text {
  transition: all 0.15s cubic-bezier(0.39, 0.575, 0.565, 1);
  transition-property: font-size;
  font-size: 0.75rem;
  line-height: 1.2;
}

.fullscreen .title-author-texts {
  bottom: calc(50% - var(--cover-image-height) / 2 + 50px);
  width: 80%;
  left: 10%;
  text-align: center;
  padding-bottom: calc(((260px - var(--cover-image-height)) / 260) * 40);
  pointer-events: auto;
}
.fullscreen .title-author-texts .title-text {
  font-size: clamp(0.8rem, calc(var(--cover-image-height) / 260 * 20), 1.3rem);
}
.fullscreen .title-author-texts .author-text {
  font-size: clamp(0.6rem, calc(var(--cover-image-height) / 260 * 16), 1rem);
}

#playerControls {
  transition: all 0.15s cubic-bezier(0.39, 0.575, 0.565, 1);
  transition-property: width, bottom;
  width: 128px;
  padding-right: 24px;
  bottom: 70px;
}
#playerControls .jump-icon {
  transition: all 0.15s cubic-bezier(0.39, 0.575, 0.565, 1);
  transition-property: font-size;

  margin: 0px 0px;
  font-size: 1.6rem;
}
#playerControls .jump-label {
  margin-top: 2px;
}
#playerControls .play-btn {
  transition: all 0.15s cubic-bezier(0.39, 0.575, 0.565, 1);
  transition-property: padding, margin, height, width, min-width, min-height;

  height: 40px;
  width: 40px;
  min-width: 40px;
  min-height: 40px;
  margin: 0px 7px;
}
#playerControls .play-btn .material-symbols {
  transition: all 0.15s cubic-bezier(0.39, 0.575, 0.565, 1);
  transition-property: font-size;

  font-size: 1.5rem;
}

.fullscreen .cover-wrapper {
  margin: 0 auto;
  height: var(--cover-image-height);
  width: var(--cover-image-width);
  left: calc(50% - (calc(var(--cover-image-width)) / 2));
  bottom: calc(50% + 120px - (calc(var(--cover-image-height)) / 2));
  border-radius: 16px;
  overflow: hidden;
}

.fullscreen #playerControls {
  width: 100%;
  padding-left: 24px;
  padding-right: 24px;
  bottom: 78px;
  left: 0;
}
.fullscreen #playerControls .jump-icon {
  font-size: 2.4rem;
}
.fullscreen #playerControls .next-icon {
  font-size: 2rem;
}
.fullscreen #playerControls .play-btn {
  height: 65px;
  width: 65px;
  min-width: 65px;
  min-height: 65px;
}
.fullscreen #playerControls .play-btn .material-symbols {
  font-size: 2.1rem;
}

/* ── Landscape fullscreen: two-column layout ── */
@media (orientation: landscape) {
  /* Cover moves to left half */
  .fullscreen .cover-wrapper {
    left: 5%;
    width: var(--cover-image-height); /* square-ish in landscape */
    height: var(--cover-image-height);
    bottom: 50%;
    transform: translateY(50%);
  }

  /* Title/author to right column, vertically centered */
  .fullscreen .title-author-texts {
    left: 52%;
    width: 44%;
    text-align: left;
    bottom: unset;
    top: 12%;
    padding-bottom: 0;
  }

  /* Player controls to right column, above seek track */
  .fullscreen #playerControls {
    left: 52%;
    width: 44%;
    padding-left: 0;
    padding-right: 0;
    bottom: 82px !important;
  }

  /* Track bar to right column, above toolbar */
  .fullscreen #playerTrack {
    left: 52%;
    width: 44%;
    padding-left: 0;
    padding-right: 0;
    bottom: 50px !important;
  }

  /* In landscape, the playerContent bar stays full-width but transparent
     background is handled by the z-10 cover div underneath */
  .fullscreen .playerContainer {
    height: 100%;
    background-color: transparent !important;
  }

  /* Total track bar to right column */
  .fullscreen .total-track {
    left: 52%;
    right: 4%;
    bottom: 125px;
    padding-left: 0;
    padding-right: 0;
  }

  /* Top bar controls: smaller top offset to avoid overlapping cover art */
  .fullscreen .top-4.left-4 { top: 8px !important; }
  .fullscreen .top-6.right-4 { top: 8px !important; }
  .fullscreen .top-6.right-16 { top: 8px !important; }

  /* Fullscreen bottom toolbar (bookmark/speed/sleep/queue/chapters):
     move to right column, above the seek track */
  .fullscreen #playerContent .absolute.bottom-4 {
    left: 52%;
    width: 44%;
    bottom: 8px;
    padding: 0;
    max-width: none;
  }

  /* Hide the playback method label (Direct/Local/Transcode) in landscape —
     it overlaps the album art title text */
  .fullscreen .top-4.absolute.left-0.right-0 {
    display: none !important;
  }

  /* ── Mini-player landscape: seek bar as translucent background fill ── */

  /* Compact padding — content floats on top of the fill */
  #streamContainer:not(.fullscreen) #playerContent {
    padding: 4px 8px;
    overflow: hidden;
  }

  /* Stretch track container to fill the full mini-player height, sit behind content */
  #streamContainer:not(.fullscreen) #playerTrack {
    top: 0;
    bottom: 0;
    height: 100%;
    padding: 0;
    z-index: 0;
    pointer-events: none;
  }

  /* Hide timestamps — progress communicated by fill color alone */
  #streamContainer:not(.fullscreen) #playerTrack > div:first-child {
    display: none;
  }

  /* Track line: stretch to full height, no rounding, transparent base */
  #streamContainer:not(.fullscreen) #playerTrack > div:last-child {
    height: 100%;
    border-radius: 0;
    background: transparent;
  }

  /* Played fill: semi-transparent primary green wash */
  #streamContainer:not(.fullscreen) #playerTrack .bg-track-cursor {
    background-color: rgba(26, 214, 145, 0.22) !important;
    border-radius: 0;
  }

  /* Buffer/ready fills: barely-visible tint */
  #streamContainer:not(.fullscreen) #playerTrack .bg-track-buffered,
  #streamContainer:not(.fullscreen) #playerTrack .bg-track {
    background-color: rgba(26, 214, 145, 0.07) !important;
    border-radius: 0;
  }

  /* Hide scrub cursor handle — no scrubbing in mini-player */
  #streamContainer:not(.fullscreen) #playerTrack .h-7.w-7.rounded-full {
    display: none;
  }

  /* Controls and cover float above the fill */
  #streamContainer:not(.fullscreen) #playerControls {
    position: relative;
    z-index: 1;
    padding: 0;
  }
  #streamContainer:not(.fullscreen) .cover-wrapper {
    z-index: 1;
  }

  /* Landscape mini-player height matches app.css allocation (136px = 56px appbar + 80px player) */
  #streamContainer:not(.fullscreen) .playerContainer {
    height: 80px;
  }
}

/* ── Portrait mini-player: thin progress bar at bottom ── */
@media (orientation: portrait) {
  #streamContainer:not(.fullscreen) #playerTrack {
    bottom: 0 !important;
    height: 5px !important;
    padding: 0 !important;
    z-index: 2;
    pointer-events: none;
  }
  #streamContainer:not(.fullscreen) #playerTrack > div:first-child {
    display: none;
  }
  #streamContainer:not(.fullscreen) #playerTrack > div:last-child {
    height: 5px !important;
    border-radius: 0 !important;
    background: rgba(178, 204, 192, 0.35) !important;
  }
  #streamContainer:not(.fullscreen) #playerTrack .bg-track-cursor {
    background-color: rgba(26, 214, 145, 0.9) !important;
    border-radius: 0 !important;
  }
  #streamContainer:not(.fullscreen) #playerTrack .bg-track-buffered,
  #streamContainer:not(.fullscreen) #playerTrack .bg-track {
    background-color: rgba(26, 214, 145, 0.25) !important;
    border-radius: 0 !important;
  }
  #streamContainer:not(.fullscreen) #playerTrack .h-7.w-7.rounded-full {
    display: none !important;
  }
}
</style>

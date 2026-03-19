// Playback
export interface PlayItemPayload {
  libraryItemId: string
  episodeId?: string | null
  serverLibraryItemId?: string | null
  serverEpisodeId?: string | null
  queue?: QueueItem[]
  queueIndex?: number
  startTime?: number
}

export interface QueueItem {
  libraryItemId: string
  episodeId: string | null
  serverLibraryItemId?: string | null
  serverEpisodeId?: string | null
  episode?: Record<string, unknown>
  localEpisode?: Record<string, unknown> | null
  localLibraryItem?: Record<string, unknown>
  [key: string]: unknown
}

export interface PlaybackSession {
  id: string
  libraryItemId?: string
  episodeId?: string
  localLibraryItemId?: string
  localEpisodeId?: string
  mediaPlayer?: string
  playMethod?: number
  localLibraryItem?: Record<string, unknown>
  [key: string]: unknown
}

export interface DeviceData {
  deviceSettings?: {
    jumpForwardTime?: number
    jumpBackwardsTime?: number
    enableAltView?: boolean
    lockOrientation?: string
    downloadUsingCellular?: string
    streamingUsingCellular?: string
    autoCacheUnplayedEpisodes?: boolean
    hapticFeedback?: string
  }
  lastPlaybackSession?: PlaybackSession
  [key: string]: unknown
}

export interface ServerConnectionConfig {
  id: string
  name: string
  address: string
  token: string
  [key: string]: unknown
}

export interface UserSettings {
  mobileOrderBy: string
  mobileOrderDesc: boolean
  mobileFilterBy: string
  playbackRate: number
  collapseSeries: boolean
  collapseBookSeries: boolean
}

export const DownloadStatus = {
  PENDING: 0,
  READY: 1,
  EXPIRED: 2,
  FAILED: 3
} as const

export const SyncStatus = {
  UNSET: 0,
  SUCCESS: 1,
  FAILED: 2
} as const

export const BookCoverAspectRatio = {
  STANDARD: 0,
  SQUARE: 1
} as const

export const PlayMethod = {
  DIRECTPLAY: 0,
  DIRECTSTREAM: 1,
  TRANSCODE: 2,
  LOCAL: 3
} as const

export const PlayerState = {
  IDLE: 0,
  BUFFERING: 1,
  READY: 2,
  ENDED: 3
} as const

import mitt from 'mitt'
import type { PlayItemPayload } from '~/types'

export type AppEvents = {
  'play-item': PlayItemPayload
  'pause-item': void
  'close-modal': void
  'minimize-player': void
  'close-ebook': void
  'close-stream': void
  'cast-local-item': void
  'abs-ui-ready': void
  'user-settings': Record<string, unknown>
  'playback-time-update': { currentTime: number; duration: number }
  'playback-ended': void
  'device-focus-update': boolean
  'url-open': string
  'library-changed': string
  'change-lang': string
  'new-local-library-item': Record<string, unknown>
  'bookshelf-total-entities': number
  'download-series-click': void
}

const _emitter = mitt<AppEvents>()

export const useEventBus = () => _emitter

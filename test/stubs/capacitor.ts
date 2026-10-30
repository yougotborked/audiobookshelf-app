// Stand-in for the Capacitor modules that composables import at module scope.
//
// Nothing here is exercised by the tests; it exists so that importing a module for its pure
// exports does not fail on a native bridge that does not exist outside the app. If a test
// ever needs real behaviour from one of these, mock it in that test rather than giving the
// stub opinions.
export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web',
  convertFileSrc: (url: string) => url
}

export const StatusBar = {
  setStyle: async () => undefined,
  setBackgroundColor: async () => undefined,
  show: async () => undefined,
  hide: async () => undefined
}

export const Style = { Dark: 'DARK', Light: 'LIGHT', Default: 'DEFAULT' }

// The native HTTP client. Inert: tests that need a response mock it on the instance under test.
export const CapacitorHttp = {
  request: async () => ({ status: 200, data: {}, headers: {}, url: '' })
}

// Composables that register their own plugin call this. Inert, like everything else here: the
// pure exports are what the tests import, and they do not reach the bridge.
export const registerPlugin = <T,>(_name: string, impl?: { web?: () => T }): T =>
  (impl?.web?.() ?? ({} as T))

export const Clipboard = {
  write: async () => undefined,
  read: async () => ({ value: '', type: 'text/plain' })
}

export const AbsFileSystem = {
  selectFolder: async () => ({}),
  checkFolderPermission: async () => ({ value: false })
}

// The native plugin bridge (plugins/capacitor). Methods are inert: a test that needs one to do
// something mocks it on the instance under test rather than teaching this stub behaviour.
export const AbsAudioPlayer = {
  addListener: async () => ({ remove: () => undefined }),
  prepareLibraryItem: async () => undefined,
  requestSession: async () => undefined,
  seek: async () => undefined,
  setPlaybackSpeed: async () => undefined
}

export const AbsLogger = {
  info: async () => undefined,
  error: async () => undefined
}

export const AbsDatabase = {}
export const AbsDownloader = {}

export const Dialog = {
  confirm: async () => ({ value: false }),
  alert: async () => undefined
}

export default { Capacitor, StatusBar, Style, Clipboard, AbsFileSystem, AbsAudioPlayer, AbsLogger }

// @capacitor/filesystem + @capacitor/share, which replaced the abandoned filesharer. Only the
// shapes useShareImage touches: a writeFile that reports a uri, and a share that accepts it.
export const Directory = { Cache: 'CACHE', Documents: 'DOCUMENTS', Data: 'DATA' }
export const Filesystem = {
  writeFile: async (_options: unknown) => ({ uri: 'file:///stub/shared.png' })
}
export const Share = {
  share: async (_options: unknown) => ({ activityType: '' })
}

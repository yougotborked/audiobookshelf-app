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

export const Clipboard = {
  write: async () => undefined,
  read: async () => ({ value: '', type: 'text/plain' })
}

export const AbsFileSystem = {
  selectFolder: async () => ({}),
  checkFolderPermission: async () => ({ value: false })
}

export default { Capacitor, StatusBar, Style, Clipboard, AbsFileSystem }

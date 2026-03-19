import { App } from '@capacitor/app'
import { Dialog } from '@capacitor/dialog'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'

export default defineNuxtPlugin(async () => {
  const bus = useEventBus()
  const router = useRouter()

  // Set dark status bar on non-web platforms
  if (Capacitor.getPlatform() !== 'web') {
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  }

  // Set theme from local store
  const localStore = useLocalStore()
  const theme = await localStore.getTheme()
  if (theme) {
    document.documentElement.dataset.theme = theme
  }

  // iOS: back navigation via router hook
  if (Capacitor.getPlatform() === 'ios') {
    router.beforeEach((_to, _from, next) => {
      const globalsStore = useGlobalsStore()
      const appStore = useAppStore()
      if (globalsStore.isModalOpen) bus.emit('close-modal')
      if (appStore.playerIsFullscreen) bus.emit('minimize-player')
      if (appStore.showReader) bus.emit('close-ebook')
      next()
    })
  }

  // Android: hardware back button
  App.addListener('backButton', async ({ canGoBack }) => {
    const globalsStore = useGlobalsStore()
    const appStore = useAppStore()
    if (globalsStore.isModalOpen) { bus.emit('close-modal'); return }
    if (appStore.showReader) { bus.emit('close-ebook'); return }
    if (appStore.playerIsFullscreen) { bus.emit('minimize-player'); return }
    if (!canGoBack) {
      const strings = useStrings()
      const { value } = await Dialog.confirm({
        title: strings.HeaderConfirm || 'Confirm',
        message: strings.MessageConfirmAppExit || 'Exit app?'
      })
      if (value) App.exitApp()
    } else {
      window.history.back()
    }
  })

  // Deep links
  App.addListener('appUrlOpen', (data) => {
    bus.emit('url-open', data.url)
  })
})

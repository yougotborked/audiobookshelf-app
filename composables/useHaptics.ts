import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

export function useHaptics() {
  const hapticsImpactHeavy = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }) } catch { /* ignore on web */ }
  }
  const hapticsImpactMedium = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }) } catch { /* ignore on web */ }
  }
  const hapticsImpactLight = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Light }) } catch { /* ignore on web */ }
  }
  const hapticsVibrate = async () => {
    try { await Haptics.vibrate() } catch { /* ignore on web */ }
  }
  const hapticsNotificationSuccess = async () => {
    try { await Haptics.notification({ type: NotificationType.Success }) } catch { /* ignore on web */ }
  }
  const hapticsNotificationWarning = async () => {
    try { await Haptics.notification({ type: NotificationType.Warning }) } catch { /* ignore on web */ }
  }
  const hapticsNotificationError = async () => {
    try { await Haptics.notification({ type: NotificationType.Error }) } catch { /* ignore on web */ }
  }
  const hapticsSelectionStart = async () => {
    try { await Haptics.selectionStart() } catch { /* ignore on web */ }
  }
  const hapticsSelectionChanged = async () => {
    try { await Haptics.selectionChanged() } catch { /* ignore on web */ }
  }
  const hapticsSelectionEnd = async () => {
    try { await Haptics.selectionEnd() } catch { /* ignore on web */ }
  }

  const impact = () => {
    const globalsStore = useGlobalsStore()
    const hapticFeedback = globalsStore.hapticFeedback
    if (hapticFeedback === 'OFF') return
    if (hapticFeedback === 'LIGHT') return hapticsImpactLight()
    if (hapticFeedback === 'MEDIUM') return hapticsImpactMedium()
    return hapticsImpactHeavy()
  }

  return {
    impact,
    hapticsImpactHeavy, hapticsImpactMedium, hapticsImpactLight,
    hapticsVibrate,
    hapticsNotificationSuccess, hapticsNotificationWarning, hapticsNotificationError,
    hapticsSelectionStart, hapticsSelectionChanged, hapticsSelectionEnd
  }
}

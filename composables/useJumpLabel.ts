import { getString, formatNumber } from '~/composables/useStrings'

export function useJumpLabel() {
  const getJumpLabel = (seconds: number | string): string => {
    const val = Number(seconds)
    if (isNaN(val)) return ''
    const useMinutes = val >= 120 // keep 60s as seconds
    const key = useMinutes ? 'UnitMinutesShort' : 'UnitSecondsShort'
    const unitValue = useMinutes ? val / 60 : val
    return getString(key, [formatNumber(unitValue)])
  }

  return { getJumpLabel }
}

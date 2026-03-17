import { initializeI18n, useStrings, getString, formatNumber } from '~/composables/useStrings'

export default defineNuxtPlugin(async () => {
  // Initialize i18n from local storage saved language preference
  if (process.client) {
    await initializeI18n()
  }
  const utils = useUtils()
  return {
    provide: {
      strings: useStrings(),
      getString,
      encode: utils.encode,
      bytesPretty: utils.bytesPretty,
      formatNumber,
      formatDate: utils.formatDate,
      dateDistanceFromNow: utils.dateDistanceFromNow,
      elapsedPretty: utils.elapsedPretty,
      secondsToTimestampFull: utils.secondsToTimestampFull,
    }
  }
})

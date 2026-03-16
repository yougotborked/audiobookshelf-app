import { initializeI18n } from '~/composables/useStrings'

export default defineNuxtPlugin(async () => {
  // Initialize i18n from local storage saved language preference
  if (process.client) {
    await initializeI18n()
  }
})

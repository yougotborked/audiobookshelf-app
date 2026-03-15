<template>
  <div class="w-full h-full bg-md-surface-0 flex flex-col items-center justify-center min-h-screen">
    <nuxt-link to="/" class="absolute top-4 left-4 z-20 rounded-full h-10 w-10 flex items-center justify-center">
      <span class="material-symbols text-3xl text-md-on-surface-variant">arrow_back</span>
    </nuxt-link>

    <!-- Branding -->
    <div class="flex flex-col items-center mb-8 short:hidden">
      <div class="h-20 w-20 rounded-md-2xl bg-md-surface-2 flex items-center justify-center mb-4 elevation-1">
        <img src="/Logo.png" class="h-14 w-14" />
      </div>
      <h1 class="text-md-headline-s text-md-on-surface">audiobookshelf</h1>
    </div>
    <div class="hidden short:flex items-center gap-3 mb-6">
      <div class="h-10 w-10 rounded-md-lg bg-md-surface-2 flex items-center justify-center">
        <img src="/Logo.png" class="h-7 w-7" />
      </div>
      <p class="text-md-title-l text-md-on-surface">audiobookshelf</p>
    </div>

    <connection-server-connect-form v-if="deviceData" />

    <!-- Footer -->
    <div class="flex items-center gap-2 mt-8 opacity-60">
      <a href="https://github.com/advplyr/audiobookshelf-app" target="_blank" class="text-md-label-m text-md-on-surface-variant">{{ $strings.MessageFollowTheProjectOnGithub }}</a>
      <a href="https://github.com/advplyr/audiobookshelf-app" target="_blank" aria-label="GitHub">
        <svg class="w-5 h-5 text-md-on-surface-variant" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 2.247a10 10 0 0 0-3.162 19.487c.5.088.687-.212.687-.475c0-.237-.012-1.025-.012-1.862c-2.513.462-3.163-.613-3.363-1.175a3.636 3.636 0 0 0-1.025-1.413c-.35-.187-.85-.65-.013-.662a2.001 2.001 0 0 1 1.538 1.025a2.137 2.137 0 0 0 2.912.825a2.104 2.104 0 0 1 .638-1.338c-2.225-.25-4.55-1.112-4.55-4.937a3.892 3.892 0 0 1 1.025-2.688a3.594 3.594 0 0 1 .1-2.65s.837-.262 2.75 1.025a9.427 9.427 0 0 1 5 0c1.912-1.3 2.75-1.025 2.75-1.025a3.593 3.593 0 0 1 .1 2.65a3.869 3.869 0 0 1 1.025 2.688c0 3.837-2.338 4.687-4.563 4.937a2.368 2.368 0 0 1 .675 1.85c0 1.338-.012 2.413-.012 2.75c0 .263.187.575.687.475A10.005 10.005 0 0 0 12 2.247z" fill="currentColor" />
        </svg>
      </a>
    </div>
  </div>
</template>

<script>
export default {
  layout: 'blank',
  data() {
    return {
      deviceData: null
    }
  },
  computed: {},
  methods: {
    async init() {
      await this.$store.dispatch('setupNetworkListener')
      this.deviceData = await this.$db.getDeviceData()
      this.$store.commit('setDeviceData', this.deviceData)
      await this.$store.dispatch('init')
      await this.$store.dispatch('setupNetworkListener')
    }
  },
  mounted() {
    // Reset data on logouts
    this.$store.commit('libraries/reset')
    this.$store.commit('setIsFirstLoad', true)
    this.init()
  }
}
</script>

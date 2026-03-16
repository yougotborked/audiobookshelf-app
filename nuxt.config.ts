export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  telemetry: false,

  modules: ['@pinia/nuxt', '@vueuse/nuxt'],

  css: ['~/assets/tailwind.css', '~/assets/app.css'],

  runtimeConfig: {
    public: {
      version: '0.12.0-beta',
      ANDROID_APP_URL: 'https://play.google.com/store/apps/details?id=com.audiobookshelf.app',
      IOS_APP_URL: ''
    }
  },

  app: {
    head: {
      title: 'Audiobookshelf',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'viewport-fit=cover, width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1' },
        { name: 'format-detection', content: 'telephone=no' }
      ],
      script: [{ src: '/libs/sortable.js' }],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
    }
  },

  components: {
    dirs: [{ path: '~/components', pathPrefix: false }]
  },

  imports: {
    dirs: ['stores', 'composables', 'constants']
  },

  nitro: {
    preset: 'static'
  },

  postcss: {
    plugins: {
      '@tailwindcss/postcss': {}
    }
  },

  vite: {
    define: {
      'process.env.PROD': '"1"'
    }
  }
})

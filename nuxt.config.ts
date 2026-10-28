import { execSync } from 'node:child_process'

/**
 * The app's version, from the newest release tag.
 *
 * The drawer shows this, and it used to be a literal that rotted: every sideloaded build said
 * 0.12.0-beta for weeks after 0.13.0 shipped, which makes "what version are you on" unanswerable
 * during testing - exactly when it gets asked. The Android build reads the same tag, so the
 * number in the drawer and the number in Android's app info agree.
 *
 * Failures are swallowed: a source archive, a shallow clone with no tags and a machine without
 * git are all normal, and none should stop a build.
 */
function appVersion(): string {
  if (process.env.PODSHELF_VERSION_NAME) return process.env.PODSHELF_VERSION_NAME
  try {
    return execSync('git describe --tags --abbrev=0 --match="v[0-9]*"', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
      .replace(/^v/, '')
  } catch {
    return '0.0.0-untagged'
  }
}

export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  telemetry: false,

  ignore: [
    'pages/**/_id.vue',
    'pages/**/_id/**',
    'plugins/capacitor/**'
  ],

  plugins: [
    '~/plugins/01.capacitor.client.ts',
    '~/plugins/02.socket.client.ts',
    '~/plugins/03.strings.ts',
    '~/plugins/04.toast.client.ts'
  ],

  dir: {
    public: 'static'
  },

  modules: ['@pinia/nuxt', '@vueuse/nuxt'],

  css: ['~/assets/tailwind.css', '~/assets/app.css'],

  runtimeConfig: {
    public: {
      version: appVersion(),
      ANDROID_APP_URL: 'https://play.google.com/store/apps/details?id=com.podshelf.app',
      IOS_APP_URL: '',
    }
  },

  app: {
    head: {
      title: 'Podshelf',
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
    dirs: ['~/components']
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

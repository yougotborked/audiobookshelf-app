import { execSync } from 'node:child_process'

/**
 * The app's version, from scripts/app-version.sh - the same derivation the Android build and
 * both workflows use, so the number in the drawer and the number in Android's app info agree.
 *
 * It calls the script rather than repeating `git describe` here, which is what it used to do.
 * That looked equivalent and was not: the script appends the commit count since the tag, so the
 * drawer said "0.13.0" while the installed build was versionName 0.13.0-dev.79 - a build 79
 * commits newer than the number it displayed. Three definitions of "the version" is two too
 * many, and this was the one nobody was looking at.
 *
 * PODSHELF_VERSION_NAME still wins when set, so CI can pin the value it is building rather than
 * re-deriving it.
 *
 * Failures are swallowed: a source archive, a shallow clone with no tags and a machine without
 * git are all normal, and none should stop a build.
 */
function appVersion(): string {
  if (process.env.PODSHELF_VERSION_NAME) return process.env.PODSHELF_VERSION_NAME
  try {
    return execSync('bash scripts/app-version.sh --name', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
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

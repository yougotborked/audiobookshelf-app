# Audiobookshelf App Modernization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement this plan.

**Goal:** Migrate the audiobookshelf Capacitor app from Nuxt 2/Vue 2/Vuex/Tailwind 3 to Nuxt 3/Vue 3 TypeScript/Pinia/Tailwind 4 in a single clean branch.
**Architecture:** SPA static generation (`nuxt generate`) feeding Capacitor Android; Pinia replaces Vuex; composables replace all Nuxt 2 plugin injections and mixins; `mitt` replaces the `new Vue()` event bus; Tailwind 4 CSS-first `@theme` block replaces `tailwind.config.js`.
**Tech Stack:** Nuxt 3, Vue 3, TypeScript (strict), Pinia, Tailwind CSS 4, mitt, @vueuse/core, vitest, Capacitor 7, Kotlin/AGP (Android — unchanged)

---

## Context for Every Task

- **Working branch:** `modernize/nuxt3` (create from master at Task 0.1)
- **Worktree path:** `/home/lab.abork.co/abork/workspace/audiobookshelf-app`
- **Component pattern:** Every Vue file uses `<script setup lang="ts">`. No Options API.
- **v-model pattern:** Custom components expose `modelValue` prop + emit `update:modelValue`. Remove any `value`/`input` pattern.
- **Store access:** `useAppStore()`, `useGlobalsStore()`, `useLibrariesStore()`, `useUserStore()` — never `this.$store`.
- **Composable access:** `useDb()`, `useLocalStore()`, `useNativeHttp()`, `useToast()`, `useStrings()`, `useEventBus()`, `usePlatform()`, `useHaptics()`, `useSocket()`, `useUtils()` — never `this.$xxx`.
- **Router/route:** `useRouter()` / `useRoute()` — never `this.$router` / `this.$route`.
- **Event bus:** `useEventBus().emit(...)` / `useEventBus().on(...)` — never `this.$eventBus`.
- **Socket:** `useSocket()` returns the singleton `ServerSocket` instance — used for `logout()`, `sendAuthenticate()`, etc.
- **Utilities:** `useUtils()` returns all date/string/byte helpers previously on `Vue.prototype` (`$bytesPretty`, `$elapsedPretty`, `$secondsToTimestamp`, `$formatDate`, `$encodeUriPath`, etc.).

---

## Phase 0 — Foundation (Serial)

### Task 0.1: Branch + Nuxt 3 Scaffold

**Files:**
- Create: `nuxt.config.ts`
- Modify: `package.json`
- Delete: `nuxt.config.js`

**Step 1: Create branch**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
git checkout -b modernize/nuxt3
```

**Step 2: Replace Nuxt 2 with Nuxt 3 in package.json**

Replace the `nuxt` entry and remove Nuxt 2 modules:
```json
{
  "dependencies": {
    "nuxt": "^3.14.0",
    "@pinia/nuxt": "^0.9.0",
    "pinia": "^2.3.0",
    "@vueuse/nuxt": "^12.0.0",
    "@vueuse/core": "^12.0.0",
    "mitt": "^3.0.1"
  }
}
```
Remove from dependencies: `@nuxtjs/axios`, `core-js`, `es6-promise-plugin`, `v-click-outside`, `vuex`.
Update: `vue-toastification` → `"^2.0.0-rc.5"`, `vuedraggable` → `"^4.1.0"`, `date-fns` → `"^3.6.0"`, `tailwindcss` → `"^4.0.0"`.
Update devDependencies: `@capacitor/cli` → `"^7.0.0"`, remove `@nuxtjs/eslint-config`, add `"@nuxtjs/eslint-config-typescript": "^12.0.0"`.

**Step 3: Create `nuxt.config.ts`**
```ts
import { defineNuxtConfig } from 'nuxt/config'
import pkg from './package.json'

export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  telemetry: false,

  modules: ['@pinia/nuxt', '@vueuse/nuxt'],

  css: ['~/assets/tailwind.css', '~/assets/app.css'],

  runtimeConfig: {
    public: {
      version: pkg.version,
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

  vite: {
    define: {
      'process.env.PROD': '"1"'
    }
  }
})
```

**Step 4: Delete `nuxt.config.js`**
```bash
rm nuxt.config.js
```

**Step 5: Install dependencies**
```bash
npm install
```

**Step 6: Verify**
```bash
npx nuxi info
```
Expected: Nuxt 3.x reported, no errors.

**Step 7: Commit**
```bash
git add package.json package-lock.json nuxt.config.ts
git rm nuxt.config.js
git commit -m "feat(modernize): scaffold Nuxt 3, update package.json dependencies"
```

---

### Task 0.2: TypeScript Configuration

**Files:**
- Create: `tsconfig.json`
- Create: `types/index.d.ts`

**Step 1: Create `tsconfig.json`**
```json
{
  "extends": "./.nuxt/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false
  }
}
```

**Step 2: Create `types/index.d.ts`** for shared types used throughout:
```ts
// Playback
export interface PlayItemPayload {
  libraryItemId: string
  episodeId?: string | null
  serverLibraryItemId?: string | null
  serverEpisodeId?: string | null
  queue?: QueueItem[]
  queueIndex?: number
}

export interface QueueItem {
  libraryItemId: string
  episodeId: string | null
  serverLibraryItemId?: string | null
  serverEpisodeId?: string | null
  episode?: Record<string, unknown>
  localEpisode?: Record<string, unknown> | null
}

export interface PlaybackSession {
  id: string
  libraryItemId?: string
  episodeId?: string
  localLibraryItemId?: string
  localEpisodeId?: string
  mediaPlayer?: string
  playMethod?: number
  localLibraryItem?: Record<string, unknown>
  [key: string]: unknown
}

export interface DeviceData {
  deviceSettings?: {
    jumpForwardTime?: number
    jumpBackwardsTime?: number
    enableAltView?: boolean
    lockOrientation?: string
    downloadUsingCellular?: string
    streamingUsingCellular?: string
    autoCacheUnplayedEpisodes?: boolean
    hapticFeedback?: string
  }
  lastPlaybackSession?: PlaybackSession
  [key: string]: unknown
}

export interface ServerConnectionConfig {
  id: string
  name: string
  address: string
  token: string
  [key: string]: unknown
}

export interface UserSettings {
  mobileOrderBy: string
  mobileOrderDesc: boolean
  mobileFilterBy: string
  playbackRate: number
  collapseSeries: boolean
  collapseBookSeries: boolean
}
```

**Step 3: Verify**
```bash
npx nuxi prepare
```
Expected: `.nuxt/` generated, no TS errors.

**Step 4: Commit**
```bash
git add tsconfig.json types/index.d.ts
git commit -m "feat(modernize): add TypeScript strict config and shared types"
```

---

### Task 0.3: Tailwind CSS 4 Setup

**Files:**
- Modify: `assets/tailwind.css`
- Delete: `tailwind.config.js`
- Modify: `package.json` (postcss config moves to nuxt.config.ts)

**Step 1: Update `nuxt.config.ts`** — add PostCSS config for Tailwind 4:
In `nuxt.config.ts`, add:
```ts
  postcss: {
    plugins: {
      '@tailwindcss/postcss': {}
    }
  },
```
Remove any `build.postcss` from the Nuxt 2 config (already deleted).

**Step 2: Install `@tailwindcss/postcss`**
```bash
npm install -D @tailwindcss/postcss
```

**Step 3: Rewrite `assets/tailwind.css`**

Replace the file with:
```css
@import "tailwindcss";

@theme {
  /* ── Backward-compat legacy tokens ── */
  --color-bg: rgb(var(--color-bg));
  --color-bg-hover: rgb(var(--color-bg-hover));
  --color-fg: rgb(var(--color-fg));
  --color-fg-muted: rgb(var(--color-fg-muted));
  --color-secondary: rgb(var(--color-secondary));
  --color-primary: rgb(var(--color-primary));
  --color-border: rgb(var(--color-border));
  --color-bg-toggle: rgb(var(--color-bg-toggle));
  --color-bg-toggle-selected: rgb(var(--color-bg-toggle-selected));
  --color-track-cursor: rgb(var(--color-track-cursor));
  --color-track: rgb(var(--color-track));
  --color-track-buffered: rgb(var(--color-track-buffered));
  --color-accent: #1ad691;
  --color-error: #FF5252;
  --color-info: #2196F3;
  --color-success: #4CAF50;
  --color-successDark: #3b8a3e;
  --color-warning: #FB8C00;

  /* ── M3 Surface Levels ── */
  --color-md-surface-0: rgb(var(--md-surface-0));
  --color-md-surface-1: rgb(var(--md-surface-1));
  --color-md-surface-2: rgb(var(--md-surface-2));
  --color-md-surface-3: rgb(var(--md-surface-3));
  --color-md-surface-4: rgb(var(--md-surface-4));
  --color-md-surface-5: rgb(var(--md-surface-5));
  --color-md-primary: rgb(var(--md-primary));
  --color-md-on-primary: rgb(var(--md-on-primary));
  --color-md-primary-container: rgb(var(--md-primary-container));
  --color-md-on-primary-container: rgb(var(--md-on-primary-container));
  --color-md-on-surface: rgb(var(--md-on-surface));
  --color-md-on-surface-variant: rgb(var(--md-on-surface-variant));
  --color-md-outline: rgb(var(--md-outline));
  --color-md-outline-variant: rgb(var(--md-outline-variant));
  --color-md-error: rgb(var(--md-error));
  --color-md-error-container: rgb(var(--md-error-container));
  --color-dynamic-primary: rgb(var(--dynamic-primary));
  --color-dynamic-surface: rgb(var(--dynamic-surface));

  /* ── M3 Shape ── */
  --radius-md-xs: var(--md-shape-xs);
  --radius-md-sm: var(--md-shape-sm);
  --radius-md-md: var(--md-shape-md);
  --radius-md-lg: var(--md-shape-lg);
  --radius-md-xl: var(--md-shape-xl);
  --radius-md-2xl: 36px;
  --radius-md-full: var(--md-shape-full);

  /* ── M3 Type Scale ── */
  --font-size-1-5xl: 1.375rem;
  --font-size-xxs: 0.625rem;
  --font-size-md-display-l: 3.5625rem;
  --font-size-md-display-m: 2.8125rem;
  --font-size-md-display-s: 2.25rem;
  --font-size-md-headline-l: 2rem;
  --font-size-md-headline-m: 1.75rem;
  --font-size-md-headline-s: 1.5rem;
  --font-size-md-title-l: 1.375rem;
  --font-size-md-title-m: 1rem;
  --font-size-md-title-s: 0.875rem;
  --font-size-md-body-l: 1rem;
  --font-size-md-body-m: 0.875rem;
  --font-size-md-body-s: 0.75rem;
  --font-size-md-label-l: 0.875rem;
  --font-size-md-label-m: 0.75rem;
  --font-size-md-label-s: 0.6875rem;

  /* ── Spacing extras ── */
  --spacing-4-5: 1.125rem;
  --spacing-18: 4.5rem;

  /* ── Fonts ── */
  --font-family-sans: 'Source Sans Pro', sans-serif;
  --font-family-mono: 'Ubuntu Mono', monospace;
}

/* Tailwind 4 screen variants (custom breakpoints) */
@custom-variant short (@media (max-height: 500px));
@custom-variant landscape (@media (orientation: landscape));
```

**Step 4: Delete `tailwind.config.js`**
```bash
git rm tailwind.config.js
```

**Step 5: Verify build starts**
```bash
npx nuxi dev --no-open 2>&1 | head -30
```
Expected: Vite server starts, CSS compiles without errors.

**Step 6: Commit**
```bash
git add assets/tailwind.css nuxt.config.ts package.json package-lock.json
git rm tailwind.config.js
git commit -m "feat(modernize): migrate Tailwind 3 to Tailwind 4 CSS-first config"
```

---

### Task 0.4: Pinia Stores

**Files:**
- Create: `stores/app.ts`
- Create: `stores/globals.ts`
- Create: `stores/libraries.ts`
- Create: `stores/user.ts`
- Delete: `store/index.js`, `store/globals.js`, `store/libraries.js`, `store/user.js`

**Step 1: Create `stores/app.ts`**

Port `store/index.js` → Pinia `defineStore`. Key points:
- State, getters, actions all in one `defineStore` call
- `this.$localStore` → `useLocalStore()` composable
- `this.$db` → `useDb()` composable
- `this.$nativeHttp` → `useNativeHttp()` composable
- `this.$platform` → `usePlatform()` composable
- Preserve all logic: `sanitizeQueue`, `resolveQueueItemIds`, all mutations as actions

```ts
import { defineStore } from 'pinia'
import { Network } from '@capacitor/network'
import { AbsAudioPlayer, AbsDownloader, AbsLogger } from '~/plugins/capacitor'
import { PlayMethod } from '~/constants'
import type { PlaybackSession, DeviceData, QueueItem } from '~/types'

// ... (port full store/index.js logic)
export const useAppStore = defineStore('app', {
  state: (): AppState => ({ /* all fields from store/index.js state() */ }),
  getters: { /* all getters */ },
  actions: { /* all mutations renamed as actions + existing actions */ }
})
```

**Step 2: Create `stores/globals.ts`**

Port `store/globals.js`. `getLibraryItemCoverSrc` getter references `useUserStore()` and `useAppStore()` — call them inside the getter function body.

```ts
export const useGlobalsStore = defineStore('globals', {
  state: (): GlobalsState => ({ /* all fields */ }),
  getters: { /* all getters — call other stores inside function bodies */ },
  actions: { /* loadLocalMediaProgress + all mutations */ }
})
```

**Step 3: Create `stores/libraries.ts`**

Port `store/libraries.js`.

```ts
export const useLibrariesStore = defineStore('libraries', {
  state: (): LibrariesState => ({ /* all fields */ }),
  getters: { /* all getters */ },
  actions: { /* fetch + all mutations */ }
})
```

**Step 4: Create `stores/user.ts`**

Port `store/user.js`. Key references to fix:
- `this.$eventBus.$emit('user-settings', ...)` → `useEventBus().emit('user-settings', settings)`
- `this.$socket.logout()` (line 161) → `useSocket().logout()`
- `this.$socket?.connected` (line 210) → `useSocket()?.connected`
- `this.$socket.sendAuthenticate()` (line 211) → `useSocket().sendAuthenticate()`
- `this.$db.getRefreshToken(...)` → `useDb().getRefreshToken(...)`
- `this.$db.setServerConnectionConfig(...)` → `useDb().setServerConnectionConfig(...)`
- `this.$nativeHttp.post('/logout', ...)` → `useNativeHttp().post('/logout', ...)`
- `this.$localStore.removeLastLibraryId()` → `useLocalStore().removeLastLibraryId()`

```ts
export const useUserStore = defineStore('user', {
  state: (): UserState => ({ /* all fields */ }),
  getters: { /* all getters */ },
  actions: { /* all actions + mutations; use useSocket(), useDb(), useNativeHttp(), useLocalStore(), useEventBus() */ }
})
```

**Step 5: Verify TypeScript**
```bash
npx nuxi prepare && npx tsc --noEmit 2>&1 | head -40
```
Expected: Errors of the form `Cannot find module '~/composables/useDb'` or similar are **expected and safe** at this stage — composables are created in Task 0.6. Errors about unknown properties on `UserState` or missing type annotations are **not** acceptable and must be fixed now.

**Step 6: Commit**
```bash
git add stores/
git rm store/index.js store/globals.js store/libraries.js store/user.js
git commit -m "feat(modernize): Vuex → Pinia (4 typed stores)"
```

---

### Task 0.5: Event Bus (mitt)

**Files:**
- Create: `composables/useEventBus.ts`

**Step 1: Create `composables/useEventBus.ts`**

Enumerate ALL events from a grep of the codebase first:
```bash
grep -rn 'eventBus\.\$emit\|bus\.emit\|eventBus\.\$on\|bus\.on' \
  plugins/ store/ components/ pages/ --include="*.js" --include="*.vue" \
  | grep -oP "(?<=emit\(|on\()['\"][^'\"]+['\"]" | sort -u
```

Then create the typed event map:
```ts
import mitt from 'mitt'
import type { PlayItemPayload } from '~/types'

export type AppEvents = {
  'play-item': PlayItemPayload
  'close-modal': void
  'minimize-player': void
  'close-ebook': void
  'user-settings': Record<string, unknown>
  'stream-progress': { currentTime: number; duration: number }
  'playback-session-updated': Record<string, unknown>
  'item-downloaded': { libraryItemId: string }
  'refresh-library-item': { id: string }
  // Add any additional events found by the grep above
}

const _emitter = mitt<AppEvents>()

export const useEventBus = () => _emitter
```

**Step 2: Verify**
```bash
npx tsc --noEmit 2>&1 | grep "useEventBus" | head -10
```
Expected: no errors in this file.

**Step 3: Commit**
```bash
git add composables/useEventBus.ts
git commit -m "feat(modernize): typed mitt event bus composable"
```

---

### Task 0.5b: Utility Composable (`useUtils`) + Socket Composable (`useSocket`)

**Files:**
- Create: `composables/useUtils.ts`
- Create: `composables/useSocket.ts`
- Modify: `plugins/capacitor/index.ts` (rename from `.js` to `.ts`, add types)

**Step 1: Create `composables/useUtils.ts`**

Port ALL 16 `Vue.prototype.$xxx` utility functions from `plugins/init.client.js` lines 21–200:
```ts
import { formatDistance, format, addDays, isDate, setDefaultOptions } from 'date-fns'
import type { Locale } from 'date-fns'
import * as locales from 'date-fns/locale'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'
import { AbsFileSystem } from '~/plugins/capacitor'

export function useUtils() {
  const showHideStatusBar = async (show: boolean) => { /* port $showHideStatusBar */ }
  const isDev = process.env.NODE_ENV !== 'production'
  const getAndroidSDKVersion = async (): Promise<number | null> => { /* port $getAndroidSDKVersion */ }
  const encodeUriPath = (path: string): string => path.replace(/\\/g, '/').replace(/%/g, '%25').replace(/#/g, '%23')
  const setDateFnsLocale = (localeString: string) => { /* port $setDateFnsLocale */ }
  const dateDistanceFromNow = (unixms: number | null): string => { /* port $dateDistanceFromNow */ }
  const formatDate = (unixms: number | null, fmt = 'MM/dd/yyyy HH:mm'): string => { /* port $formatDate */ }
  const formatJsDate = (jsdate: Date | null, fmt = 'MM/dd/yyyy HH:mm'): string => { /* port $formatJsDate */ }
  const addDaysToToday = (daysToAdd: number): Date | null => { /* port $addDaysToToday */ }
  const addDaysToDate = (jsdate: Date, daysToAdd: number): Date | null => { /* port $addDaysToDate */ }
  const bytesPretty = (bytes: number, decimals = 2): string => { /* port $bytesPretty */ }
  const elapsedPretty = (seconds: number, useFullNames = false): string => { /* port $elapsedPretty */ }
  const elapsedPrettyExtended = (seconds: number, useDays = true, showSeconds = true): string => { /* port $elapsedPrettyExtended */ }
  const secondsToTimestamp = (seconds: number): string => { /* port $secondsToTimestamp */ }
  const secondsToTimestampFull = (seconds: number): string => { /* port $secondsToTimestampFull */ }
  const sanitizeFilename = (input: string, colonReplacement = ' - '): string | false => { /* port $sanitizeFilename */ }
  return {
    showHideStatusBar, isDev, getAndroidSDKVersion, encodeUriPath, setDateFnsLocale,
    dateDistanceFromNow, formatDate, formatJsDate, addDaysToToday, addDaysToDate,
    bytesPretty, elapsedPretty, elapsedPrettyExtended, secondsToTimestamp,
    secondsToTimestampFull, sanitizeFilename
  }
}
```

Read `plugins/init.client.js` lines 21–200 fully and implement each function body exactly.

**Step 2: Create `composables/useSocket.ts`**

The socket singleton is created in `plugins/02.socket.client.ts` and needs to be accessible inside Pinia stores (which can't use `useNuxtApp()`). Use a module-level singleton:
```ts
// composables/useSocket.ts
import type { ServerSocket } from '~/types/socket'

let _socket: ServerSocket | null = null

export function setSocket(socket: ServerSocket) {
  _socket = socket
}

export function useSocket(): ServerSocket {
  if (!_socket) throw new Error('Socket not initialized — ensure plugin/02.socket.client.ts loaded first')
  return _socket
}
```

In `plugins/02.socket.client.ts`, after creating the socket, call `setSocket(socket)`.

**Step 3: Add `@capacitor/screen-orientation`**

Check if `cordova-plugin-screen-orientation` is used:
```bash
grep -rn "screen-orientation\|ScreenOrientation\|lockOrientation" \
  plugins/ store/ components/ pages/ --include="*.js" --include="*.vue" --include="*.ts"
```
If found: add `@capacitor/screen-orientation` to `package.json` and replace the Cordova calls.
If not found: remove `cordova-plugin-screen-orientation` from `package.json` (it's unused).

**Step 4: Retain Capacitor barrel module**

Read `plugins/capacitor/index.js`. Create `plugins/capacitor/index.ts` with typed exports preserving all exported names (`AbsAudioPlayer`, `AbsDownloader`, `AbsLogger`, `AbsFileSystem`, `AbsDatabase`). This file stays at `~/plugins/capacitor` — do NOT delete it.

**Step 5: Verify**
```bash
npx tsc --noEmit 2>&1 | grep "useUtils\|useSocket\|capacitor/index" | head -10
```

**Step 6: Commit**
```bash
git add composables/useUtils.ts composables/useSocket.ts plugins/capacitor/index.ts package.json
git commit -m "feat(modernize): useUtils (16 prototype helpers), useSocket singleton, typed capacitor barrel"
```

---

### Task 0.6: Plugin Porting (10 plugins → Nuxt 3 + composables)

**Files:**
- Create: `plugins/01.capacitor.client.ts`
- Create: `plugins/02.socket.client.ts`
- Create: `plugins/03.strings.ts`
- Create: `composables/useDb.ts`
- Create: `composables/useLocalStore.ts`
- Create: `composables/useNativeHttp.ts`
- Create: `composables/useToast.ts`
- Create: `composables/useHaptics.ts`
- Create: `composables/usePlatform.ts`
- Create: `composables/useStrings.ts`
- Create: `constants/index.ts`
- Delete: `plugins/init.client.js`, `plugins/axios.js`, `plugins/db.js`, `plugins/localStore.js`, `plugins/nativeHttp.js`, `plugins/toast.js`, `plugins/constants.js`, `plugins/haptics.js`, `plugins/i18n.js`, `plugins/server.js`

**Step 1: Read source plugins**

Read `plugins/init.client.js`, `plugins/db.js`, `plugins/localStore.js`, `plugins/nativeHttp.js`, `plugins/toast.js`, `plugins/constants.js`, `plugins/haptics.js`, `plugins/i18n.js`, `plugins/server.js` in full before writing anything.

**Step 2: Create `composables/useDb.ts`**

Port `plugins/db.js` — wraps PaperDB and secure storage. Export a singleton via module-level variable so it's created once.
```ts
// All methods from $db become named functions exported from a singleton
let _db: DbInstance | null = null
export function useDb() {
  if (!_db) _db = createDb()
  return _db
}
```

**Step 3: Create `composables/useLocalStore.ts`**

Port `plugins/localStore.js` — wraps `@capacitor/preferences`. Same singleton pattern.

**Step 4: Create `composables/useNativeHttp.ts`**

Port `plugins/nativeHttp.js`. Must preserve:
- Auth token injection (reads from `useUserStore().accessToken`)
- Server address resolution (reads from `useUserStore().serverConnectionConfig.address`)
- Error handling (401 → token refresh flow)
- All methods: `get`, `post`, `put`, `patch`, `delete`

```ts
export function useNativeHttp() {
  const userStore = useUserStore()
  // ... methods that use userStore.accessToken + serverConnectionConfig.address
  return { get, post, put, patch, delete: del }
}
```

**Step 5: Create `composables/useToast.ts`**

Port `plugins/toast.js` wrapping `vue-toastification` v2:
```ts
import { useToast as _useToast } from 'vue-toastification'
export function useToast() {
  const toast = _useToast()
  return {
    success: (msg: string) => toast.success(msg),
    error: (msg: string) => toast.error(msg),
    info: (msg: string) => toast.info(msg),
    warning: (msg: string) => toast.warning(msg)
  }
}
```

**Step 6: Create `composables/useHaptics.ts`**

Port `plugins/haptics.js`:
```ts
import { Haptics, ImpactStyle } from '@capacitor/haptics'
export function useHaptics() {
  const impact = async (style: ImpactStyle = ImpactStyle.Light) => {
    try { await Haptics.impact({ style }) } catch { /* ignore on web */ }
  }
  return { impact }
}
```

**Step 7: Create `composables/usePlatform.ts`**
```ts
import { Capacitor } from '@capacitor/core'
export function usePlatform() {
  return Capacitor.getPlatform() // 'android' | 'ios' | 'web'
}
```

**Step 8: Create `constants/index.ts`**

Port `plugins/constants.js` — rename to direct named exports:
```ts
export const PlayMethod = { DIRECT_PLAY: 0, DIRECT_STREAM: 1, TRANSCODE: 2, LOCAL: 3 } as const
export const BookCoverAspectRatio = { SQUARE: 0, STANDARD: 1 } as const
// ... all other constants
```

**Step 9: Create `composables/useStrings.ts`**

**First:** Read `plugins/i18n.js` fully. Determine:
- Are strings loaded synchronously from a bundled JSON file, or fetched async from the server?
- Is the strings object reactive (updated when locale changes), or static?

Then implement accordingly:
- If static bundled: `export const useStrings = () => strings` where `strings` is the imported JSON object
- If reactive/async: use `const strings = ref<StringsType>(defaultStrings)` and return `readonly(strings)`. The plugin `plugins/03.strings.ts` calls `strings.value = loadedStrings` after fetch.

```ts
// composables/useStrings.ts — adapt based on what plugins/i18n.js actually does
import type { AppStrings } from '~/types'

// Read plugins/i18n.js BEFORE implementing — pattern depends on whether strings are static or dynamic
const _strings = ref<AppStrings>({} as AppStrings)

export function setStrings(s: AppStrings) { _strings.value = s }
export function useStrings() { return readonly(_strings) }
```

Add `AppStrings` type to `types/index.d.ts` based on the actual strings object structure in `plugins/i18n.js`.

**Step 10: Create `plugins/01.capacitor.client.ts`**

Extract from `plugins/init.client.js`:
- App init / `App.addListener('backButton', ...)`
- Deep link handling (`App.addListener('appUrlOpen', ...)`)
- `SplashScreen.hide()`
- Orientation lock

```ts
export default defineNuxtPlugin(async () => {
  const { App } = await import('@capacitor/app')
  const bus = useEventBus()
  // back button handling
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) { window.history.back() }
    else { bus.emit('close-modal') }
  })
  // deep links, splash screen, etc.
})
```

**Step 11: Create `plugins/02.socket.client.ts`**

Extract socket.io logic from `plugins/init.client.js` and `plugins/server.js`:
```ts
export default defineNuxtPlugin(() => {
  const appStore = useAppStore()
  const userStore = useUserStore()
  // All socket.io connection, auth, reconnect, event listener setup
  // Expose socket via provide or via a module-level singleton
  const socket = createSocket()
  return { provide: { socket } }
})
```

**Step 12: Create `plugins/03.strings.ts`**

```ts
export default defineNuxtPlugin(() => {
  // strings are now available via useStrings() composable
  // This plugin may just initialize the strings store if needed
})
```

**Step 13: Register `vue-toastification` v2**

Create `plugins/04.toast.client.ts` (numbered to run after capacitor/socket/strings plugins):
```ts
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(Toast, {
    timeout: 3000,
    closeOnClick: true,
    pauseOnFocusLoss: false
  })
})
```
The `04.` prefix ensures this plugin runs after `01.capacitor`, `02.socket`, `03.strings` — required because `useToast()` from vue-toastification needs the plugin installed before first call.

**Step 14: Verify**
```bash
npx tsc --noEmit 2>&1 | head -60
```
Expected: no errors from composables directory.

**Step 15: Commit**
```bash
git add composables/ plugins/ constants/
git rm plugins/init.client.js plugins/axios.js plugins/db.js \
        plugins/localStore.js plugins/nativeHttp.js plugins/toast.js \
        plugins/constants.js plugins/haptics.js plugins/i18n.js plugins/server.js
git commit -m "feat(modernize): port all plugins to Nuxt 3 composables"
```

---

### Task 0.7: Mixins → Composables

**Files:**
- Create: `composables/useJumpLabel.ts`
- Create: `composables/useAutoPlaylist.ts`
- Create: `composables/useBookshelfCards.ts`
- Create: `composables/useCellularPermission.ts`
- Delete: `mixins/jumpLabel.js`, `mixins/autoPlaylistHelpers.js`, `mixins/bookshelfCardsHelpers.js`, `mixins/cellularPermissionHelpers.js`

**Step 1:** Read each mixin file fully before porting.

**Step 2:** For each mixin, create the equivalent composable using `ref`, `computed`, `watch` from Vue 3. Computed properties and methods become `computed()` and regular functions. Data properties become `ref()`. Props are passed as arguments to the composable.

Example for `useJumpLabel.ts`:
```ts
import { computed } from 'vue'

export function useJumpLabel(jumpForwardTime: Ref<number>, jumpBackwardsTime: Ref<number>) {
  const jumpForwardLabel = computed(() => formatJumpLabel(jumpForwardTime.value))
  const jumpBackwardsLabel = computed(() => formatJumpLabel(jumpBackwardsTime.value))
  return { jumpForwardLabel, jumpBackwardsLabel }
}
```

**Step 3: Verify**
```bash
npx tsc --noEmit 2>&1 | grep "composables/use" | head -20
```

**Step 4: Commit**
```bash
git add composables/useJumpLabel.ts composables/useAutoPlaylist.ts \
        composables/useBookshelfCards.ts composables/useCellularPermission.ts
git rm mixins/jumpLabel.js mixins/autoPlaylistHelpers.js \
       mixins/bookshelfCardsHelpers.js mixins/cellularPermissionHelpers.js
git commit -m "feat(modernize): port 4 mixins to typed composables"
```

---

### Task 0.8: npm Install + Build Smoke Test

**Files:**
- Modify: `package.json` (finalize any remaining changes)

**Step 1: Verify all old packages removed**
```bash
grep -E "vuex|@nuxtjs/axios|core-js|es6-promise-plugin|v-click-outside" package.json
```
Expected: no matches.

**Step 1b: Verify Capacitor plugin versions all match CLI version**
```bash
grep "@capacitor" package.json | grep -v '"^7'
```
Expected: zero non-7.x Capacitor entries. If any show `^6.x`, update them to `^7.0.0`.

**Step 1c: Fix `date-fns` v3 import style**

`date-fns` v3 drops the default export and the `date-fns/locale` wildcard import changes. Update `composables/useUtils.ts`:
```ts
// date-fns v3: use named imports from subpaths
import { formatDistance, format, addDays, isDate, setDefaultOptions } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'  // or use: import * as locales from 'date-fns/locale'
```
Verify no remaining `import * as locale from 'date-fns/locale'` wildcards (v3 changed locale exports — use named locale imports or the updated `date-fns/locale` barrel).

**Step 2: Install and dedupe**
```bash
npm install && npm dedupe
```

**Step 3: Nuxt prepare**
```bash
npx nuxi prepare
```
Expected: `.nuxt/` generated without errors.

**Step 4: Type check**
```bash
npx tsc --noEmit 2>&1 | wc -l
```
Expected: < 50 errors (some will exist from not-yet-ported components — acceptable at this stage).

**Step 5: Commit**
```bash
git add package.json package-lock.json
git commit -m "chore(modernize): finalize npm package.json after full Phase 0"
```

---

## Phase 1 — App Shell (Serial)

> **Prerequisite:** Phase 0 complete. All composables and stores exist.

### Task 1.1: Layouts

**Files:**
- Modify: `layouts/default.vue`
- Modify: `layouts/blank.vue`

**Step 1:** Read `layouts/default.vue` and `layouts/blank.vue` in full.

**Step 2:** Convert each to `<script setup lang="ts">`. Nuxt 3 layouts use `<slot />` instead of `<Nuxt />`. Replace `<nuxt />` with `<slot />`. Replace `this.$store.*` with Pinia store calls. Replace `this.$xxx` with composables.

**Step 3:** Verify
```bash
npx tsc --noEmit 2>&1 | grep "layouts/" | head -10
```
Expected: no errors in layout files.

**Step 4: Commit**
```bash
git add layouts/
git commit -m "feat(modernize): port layouts to Nuxt 3 <script setup lang=ts>"
```

---

### Task 1.2: Appbar

**Files:**
- Modify: `components/app/Appbar.vue`

**Step 1:** Read `components/app/Appbar.vue` in full.

**Step 2:** Convert to `<script setup lang="ts">`:
- `this.$store.state.xxx` → `useAppStore().xxx`
- `this.$route` → `useRoute()`
- `this.$router` → `useRouter()`
- `this.$eventBus.$emit` → `useEventBus().emit`
- `this.$strings` → `useStrings()`

**Step 3: Verify**
```bash
npx tsc --noEmit 2>&1 | grep "Appbar" | head -10
```

**Step 4: Commit**
```bash
git add components/app/Appbar.vue
git commit -m "feat(modernize): port Appbar to Vue 3 script setup"
```

---

### Task 1.3: SideDrawer

**Files:**
- Modify: `components/app/SideDrawer.vue`

Same pattern as Task 1.2. Read file fully, convert to `<script setup lang="ts">`, replace all `this.$xxx` references.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "SideDrawer" | head -10
```

**Commit:**
```bash
git add components/app/SideDrawer.vue
git commit -m "feat(modernize): port SideDrawer to Vue 3 script setup"
```

---

### Task 1.4: AudioPlayer (High Risk)

**Files:**
- Modify: `components/app/AudioPlayer.vue`
- Create: `components/app/AudioPlayerMini.vue` (extract mini-bar if file stays >600 lines post-port)

**Step 1:** Read `components/app/AudioPlayer.vue` in full (1479 lines).

**Step 2:** Map all lifecycle hooks:
- `mounted()` → `onMounted()`
- `beforeDestroy()` → `onBeforeUnmount()`
- `watch: { ... }` → `watch()` calls

**Step 3:** Map all refs — `this.$refs.track` → `const track = ref<HTMLElement>()`.

**Step 4:** Map all store access:
- `this.$store.state.currentPlaybackSession` → `appStore.currentPlaybackSession`
- `this.$store.commit('setPlaybackSession', ...)` → `appStore.setPlaybackSession(...)`
- etc.

**Step 5:** Map all plugin calls:
- `this.$nativeHttp.get(...)` → `useNativeHttp().get(...)`
- `this.$eventBus.$emit(...)` → `useEventBus().emit(...)`
- `this.$hapticsImpact()` → `useHaptics().impact()`

**Step 6:** Port the `WrappingMarquee` import — verify it works as an ES module import.

**Step 7:** Port `useJumpLabel` mixin — `...jumpLabelMixin` → `const { jumpForwardLabel, jumpBackwardsLabel } = useJumpLabel(jumpForwardTime, jumpBackwardsTime)`.

**Step 8:** Verify
```bash
npx tsc --noEmit 2>&1 | grep "AudioPlayer" | head -20
```
Expected: no errors.

**Step 9: Commit**
```bash
git add components/app/AudioPlayer.vue components/app/AudioPlayerMini.vue
git commit -m "feat(modernize): port AudioPlayer to Vue 3 script setup (highest risk)"
```

---

### Task 1.5: Shell Smoke Test

**Step 1: Generate static build**
```bash
npx nuxi generate 2>&1 | tail -20
```
Expected: "Generated" output, no fatal errors.

**Step 2: Capacitor sync**
```bash
npm run generate && npx cap sync android
```
Expected: sync completes without errors.

**Step 3: Type check**
```bash
npx tsc --noEmit 2>&1 | wc -l
```
Expected: < 30 errors (remaining from unported components).

**Step 4: Commit**
```bash
git add .
git commit -m "chore(modernize): Phase 1 shell smoke test passes"
```

---

## Phase 2 — UI & Widget Components (Parallel OK)

> Tasks 2.1 and 2.2 can run in parallel worktrees.

### Component Migration Pattern (apply to ALL Phase 2–6 tasks)

For every `.vue` file:
1. Read the file fully before editing
2. Convert `<script>` → `<script setup lang="ts">`
3. Replace `data()` fields → `ref()` / `reactive()`
4. Replace `computed: {}` → `const x = computed(() => ...)`
5. Replace `watch: {}` → `watch(source, handler)`
6. Replace `methods: {}` → top-level `async function` / `function`
7. Replace `props: {}` → `defineProps<{ ... }>()`
8. Replace `emits: []` / `this.$emit` → `defineEmits<{ ... }>()` + `emit()`
9. Replace `this.$store.*` → Pinia store composables
10. Replace `this.$xxx` → composables
11. Replace `this.$route/router` → `useRoute()` / `useRouter()`
12. If component uses `value` prop + emits `input` → rename to `modelValue` + `update:modelValue`
13. Replace lifecycle: `mounted` → `onMounted`, `beforeDestroy` → `onBeforeUnmount`, `destroyed` → `onUnmounted`

### Task 2.1: UI Components

**Files:** All files in `components/ui/`:
`Btn.vue`, `Checkbox.vue`, `Dropdown.vue`, `DropdownMenu.vue`, `IconBtn.vue`, `LoadingIndicator.vue`, `Menu.vue`, `MultiSelect.vue`, `RangeInput.vue`, `ReadIconBtn.vue`, `TextareaInput.vue`, `TextareaWithLabel.vue`, `TextInput.vue`, `TextInputWithLabel.vue`, `ToggleBtns.vue`, `ToggleSwitch.vue`

Apply the Component Migration Pattern to each file.

Special cases:
- `ToggleSwitch.vue`: Remove `model: { prop: 'value', event: 'input' }` — use default `modelValue`/`update:modelValue`
- `TextInput.vue`: Already has `onFocus` readonly guard — preserve it

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "components/ui/" | head -20
```
Expected: no errors.

**Commit:**
```bash
git add components/ui/
git commit -m "feat(modernize): port components/ui/* to Vue 3 script setup"
```

---

### Task 2.2: Widget Components

**Files:** All files in `components/widgets/`:
`ConnectionIndicator.vue`, `LoadingSpinner.vue`, `SpinnerIcon.vue`, `ProgressCircle.vue`, and any others present.

Apply the Component Migration Pattern to each file.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "components/widgets/" | head -20
```

**Commit:**
```bash
git add components/widgets/
git commit -m "feat(modernize): port components/widgets/* to Vue 3 script setup"
```

---

## Phase 3 — Cards & Covers (Parallel OK)

### Task 3.1: Card Components

**Files:** All files in `components/cards/`:
`AuthorCard.vue`, `AuthorSearchCard.vue`, `LazyBookCard.vue`, `LazyCollectionCard.vue`, `LazyListBookCard.vue`, `LazyPlaylistCard.vue`, `LazySeriesCard.vue`, `TagSearchCard.vue`

Apply the Component Migration Pattern. Note: `LazyBookCard.vue` uses `vuedraggable` — verify the v4 API is used (Vue 3 compatible, SortableJS-based).

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "components/cards/" | head -20
```

**Commit:**
```bash
git add components/cards/
git commit -m "feat(modernize): port components/cards/* to Vue 3 script setup"
```

---

### Task 3.2: Cover Components

**Files:** All files in `components/covers/`:
`AuthorImage.vue`, `BookCover.vue`, `CollectionCover.vue`, `GroupCover.vue`, `PlaylistCover.vue`, `PreviewCover.vue`

Apply the Component Migration Pattern.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "components/covers/" | head -20
```

**Commit:**
```bash
git add components/covers/
git commit -m "feat(modernize): port components/covers/* to Vue 3 script setup"
```

---

## Phase 4 — Modals (Parallel OK)

### Task 4.1: Top-Level Modals

**Files:** All `*.vue` directly in `components/modals/`:
`BookmarksModal.vue`, `ChaptersModal.vue`, `CustomHeadersModal.vue`, `Dialog.vue`, `FilterModal.vue`, `FullscreenCover.vue`, `FullscreenModal.vue`, `ItemDetailsModal.vue`, `Modal.vue`, `OrderModal.vue`, `PlaybackSpeedModal.vue`, `PodcastEpisodesFeedModal.vue`, `QueueModal.vue`, `SelectLocalFolderModal.vue`

Apply the Component Migration Pattern. Modals that emit `input` (used as `v-model`) must switch to `modelValue`/`update:modelValue`.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "components/modals/[A-Z]" | head -20
```

**Commit:**
```bash
git add components/modals/*.vue
git commit -m "feat(modernize): port components/modals/*.vue to Vue 3 script setup"
```

---

### Task 4.2: Sub-Modals

**Files:**
- `components/modals/bookmarks/BookmarkItem.vue`
- `components/modals/playlists/PlaylistRow.vue`
- `components/modals/rssfeeds/RssFeedMetadataBuilder.vue`
- `components/modals/rssfeeds/RssFeedModal.vue`
- Any other files in those subdirectories

Apply the Component Migration Pattern.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "components/modals/[a-z]" | head -20
```

**Commit:**
```bash
git add components/modals/bookmarks/ components/modals/playlists/ components/modals/rssfeeds/
git commit -m "feat(modernize): port modal subdirectory components to Vue 3"
```

---

## Phase 5 — Tables & Feature Components (Parallel OK)

### Task 5.1: Table Components

**Files:** All files under `components/tables/`:
`ChaptersTable.vue`, `TracksTable.vue`,
`components/tables/collection/BookTableRow.vue`, `CollectionBooksTable.vue`,
`components/tables/ebook/EbookFilesTable.vue`, `EbookFilesTableRow.vue`,
`components/tables/playlist/ItemTableRow.vue`, `PlaylistItemsTable.vue`,
`components/tables/podcast/EpisodeRow.vue`, `EpisodesTable.vue`, `LatestEpisodeRow.vue`

Apply the Component Migration Pattern.

Note: `vuedraggable` v4 (Vue 3) uses the standard default import — `import draggable from 'vuedraggable'`. Do **not** use the internal path `vuedraggable/src/vuedraggable`.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "components/tables/" | head -20
```

**Commit:**
```bash
git add components/tables/
git commit -m "feat(modernize): port components/tables/* to Vue 3 script setup"
```

---

### Task 5.2: Home Components

**Files:** All files in `components/home/`:
`BookshelfNavBar.vue`, `BookshelfToolbar.vue`, and any others.

Also: `components/bookshelf/PodcastCatchUpFeed.vue` (recently added).

Apply the Component Migration Pattern.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "components/home/\|PodcastCatchUp" | head -20
```

**Commit:**
```bash
git add components/home/ components/bookshelf/PodcastCatchUpFeed.vue
git commit -m "feat(modernize): port home and bookshelf feed components"
```

---

### Task 5.3: Bookshelf Components

**Files:** All remaining files in `components/bookshelf/` (excluding PodcastCatchUpFeed already done):
`LazyBookshelf.vue`, `LazyLibraryItemCard.vue`, and others present.

Apply the Component Migration Pattern. These components likely use `useBookshelfCards` composable (ported in Task 0.7).

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "components/bookshelf/" | head -20
```

**Commit:**
```bash
git add components/bookshelf/
git commit -m "feat(modernize): port components/bookshelf/* to Vue 3"
```

---

### Task 5.4: Remaining Components

**Files:**
- `components/connection/ServerConnectForm.vue` + others in `connection/`
- `components/forms/*.vue`
- `components/stats/YearInReviewBanner.vue` + others
- `components/readers/ComicReader.vue`, `PdfReader.vue`, `Reader.vue`

Apply the Component Migration Pattern. `PdfReader.vue` uses `@teckel/vue-pdf` — verify it's Vue 3 compatible (it is, using pdf.js).

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "components/connection/\|components/forms/\|components/stats/\|components/readers/" | head -20
```

**Commit:**
```bash
git add components/connection/ components/forms/ components/stats/ components/readers/
git commit -m "feat(modernize): port connection/forms/stats/readers components"
```

---

## Phase 6 — Pages (Parallel OK Within Groups)

> Apply Component Migration Pattern to every page. Additional considerations:
> - Pages use `definePageMeta()` for Nuxt 3 metadata (replaces `layout: 'blank'` etc.)
> - `asyncData` → `useAsyncData()` or inline `onMounted` fetch
> - `fetch()` hook → `useAsyncData()` or direct `onMounted` fetch

### Task 6.1: Auth Pages

**Files:**
- `pages/index.vue`
- `pages/connect.vue`

**Step 1:** Read both files. `pages/index.vue` is the login/redirect entry point.

**Step 2:** Convert. Any `layout: 'blank'` → `definePageMeta({ layout: 'blank' })`.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "pages/index\|pages/connect" | head -10
```

**Commit:**
```bash
git add pages/index.vue pages/connect.vue
git commit -m "feat(modernize): port auth pages to Nuxt 3"
```

---

### Task 6.2: Bookshelf Pages

**Files:**
- `pages/bookshelf.vue`
- `pages/bookshelf/index.vue`
- `pages/bookshelf/latest.vue`
- `pages/bookshelf/library.vue`
- `pages/bookshelf/authors.vue`
- `pages/bookshelf/collections.vue`
- `pages/bookshelf/playlists.vue`
- `pages/bookshelf/add-podcast.vue`
- `pages/bookshelf/series/` (all files)

Apply Component Migration Pattern.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "pages/bookshelf" | head -20
```

**Commit:**
```bash
git add pages/bookshelf.vue pages/bookshelf/
git commit -m "feat(modernize): port bookshelf pages to Nuxt 3"
```

---

### Task 6.3: Content Detail Pages

**Files:**
- `pages/collection/_id.vue` → in Nuxt 3: `pages/collection/[id].vue`
- `pages/item/` (all files)
- `pages/localMedia/` (all files)
- `pages/media/` (all files)
- `pages/playlist/` (all files)

**Important:** Nuxt 3 uses `[param]` bracket syntax for dynamic routes instead of `_param`. Rename ALL of the following files (exact renames — verified from the repo):
- `pages/collection/_id.vue` → `pages/collection/[id].vue`
- `pages/bookshelf/series/_id.vue` → `pages/bookshelf/series/[id].vue`
- `pages/playlist/_id.vue` → `pages/playlist/[id].vue`
- `pages/localMedia/folders/_id.vue` → `pages/localMedia/folders/[id].vue`
- `pages/localMedia/item/_id.vue` → `pages/localMedia/item/[id].vue`
- `pages/item/_id/index.vue` → `pages/item/[id]/index.vue`
- `pages/item/_id/_episode/index.vue` → `pages/item/[id]/[episode]/index.vue`

After renaming, verify no `_` prefixed route files remain:
```bash
find pages -name "_*.vue"
```
Expected: zero results.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "pages/collection\|pages/item\|pages/localMedia\|pages/media\|pages/playlist" | head -20
```

**Commit:**
```bash
git add pages/collection/ pages/item/ pages/localMedia/ pages/media/ pages/playlist/
git commit -m "feat(modernize): port detail pages, fix Nuxt 3 dynamic route syntax"
```

---

### Task 6.4: Utility Pages

**Files:**
- `pages/account.vue`
- `pages/settings.vue`
- `pages/downloads.vue`
- `pages/downloading.vue`
- `pages/logs.vue`
- `pages/search.vue`
- `pages/stats.vue`

Apply Component Migration Pattern.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | grep "pages/account\|pages/settings\|pages/downloads\|pages/logs\|pages/search\|pages/stats" | head -20
```

**Commit:**
```bash
git add pages/account.vue pages/settings.vue pages/downloads.vue \
        pages/downloading.vue pages/logs.vue pages/search.vue pages/stats.vue
git commit -m "feat(modernize): port utility pages to Nuxt 3"
```

---

## Phase 7 — Integration & Build (Serial)

### Task 7.1: Full TypeScript Pass + nuxt generate

**Step 1: Run full type check**
```bash
npx tsc --noEmit 2>&1 | tee /tmp/tsc-errors.txt | wc -l
```
Fix all errors in `/tmp/tsc-errors.txt`. Common fixes:
- `Property 'xxx' does not exist on type 'never'` → add type assertion or fix the ref type
- `Argument of type 'string | null' is not assignable` → add null checks
- `Cannot find module '~/types'` → verify import paths

**Step 2: Run nuxt generate**
```bash
npx nuxi generate 2>&1 | tee /tmp/generate.txt | tail -30
```
Expected: "Generated" output, zero build errors.
Fix any remaining import errors surfaced by Vite.

**Step 3: Final type check**
```bash
npx tsc --noEmit
```
Expected: zero errors (exit code 0).

**Step 4: Commit**
```bash
git add -u
git commit -m "fix(modernize): resolve all TypeScript errors post full migration"
```

---

### Task 7.2: Capacitor Sync + Android Build

**Step 1: Capacitor sync**
```bash
npm run generate && npx cap sync android
```
Expected: "Sync finished" with no errors.

**Step 2: Android debug build**
```bash
cd android && ./gradlew --no-daemon --build-cache assembleDebug 2>&1 | tail -20
```
Expected: `BUILD SUCCESSFUL`.

**Step 3: Verify APK exists**
```bash
ls android/app/build/outputs/apk/debug/*.apk
```
Expected: one `.apk` file.

**Step 4: Commit**
```bash
git add android/
git commit -m "chore(modernize): Capacitor sync + Android build verified after Nuxt 3 migration"
```

---

### Task 7.3: Lint Baseline Regeneration

**Step 1: Regenerate baseline**
```bash
cd android && ./gradlew --no-daemon generateDebugLintBaseline 2>&1 | tail -10
```
Expected: `lint-baseline.xml` updated.

**Step 2: Run static analysis**
```bash
cd android && ./gradlew --no-daemon staticAnalysis 2>&1 | tail -20
```
Expected: `staticAnalysis` task passes.

**Step 3: Commit**
```bash
git add android/app/lint-baseline.xml
git commit -m "chore(modernize): regenerate Android lint baseline post-migration"
```

---

### Task 7.4: CI Workflow Update

**Files:**
- Modify: `.github/workflows/build-apk.yml`

**Step 1:** Read `.github/workflows/build-apk.yml`.

**Step 2:** Add a TypeScript check step after `npm ci`:
```yaml
      - name: TypeScript type check
        run: npx tsc --noEmit
```

**Step 3:** Update the `nuxt generate` step if command changed.

**Step 4: Verify YAML**
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-apk.yml'))" && echo "YAML valid"
```
Expected: `YAML valid`.

**Step 5: Commit**
```bash
git add .github/workflows/build-apk.yml
git commit -m "ci(modernize): add tsc --noEmit step, update for Nuxt 3 generate"
```

---

## Phase 8 — Tests

### Task 8.1: Vitest Setup

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` script)

**Step 1: Install**
```bash
npm install -D vitest @nuxt/test-utils @vue/test-utils happy-dom
```

**Step 2: Create `vitest.config.ts`**
```ts
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['stores/**', 'composables/**']
    }
  }
})
```

**Step 3: Add test script to `package.json`**
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Verify**
```bash
npm test -- --reporter=verbose 2>&1 | head -20
```
Expected: "No test files found" (no tests yet — that's OK).

**Step 5: Commit**
```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "feat(modernize): add vitest + @nuxt/test-utils test infrastructure"
```

---

### Task 8.2: Pinia Store Unit Tests

**Files:**
- Create: `tests/unit/stores/app.test.ts`
- Create: `tests/unit/stores/user.test.ts`
- Create: `tests/unit/stores/globals.test.ts`
- Create: `tests/unit/stores/libraries.test.ts`

**Step 1:** For each store, write tests for:
- Initial state shape
- Each action/mutation with mock composables
- Key getters (especially `getIsMediaStreaming`, `getNextQueueItem`, etc.)

Example for `stores/app.test.ts`:
```ts
import { setActivePinia, createPinia } from 'pinia'
import { useAppStore } from '~/stores/app'
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('useAppStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('has correct initial state', () => {
    const store = useAppStore()
    expect(store.playerIsPlaying).toBe(false)
    expect(store.playQueue).toEqual([])
    expect(store.queueIndex).toBeNull()
  })

  it('setPlayQueue sanitizes queue items', () => {
    const store = useAppStore()
    store.setPlayQueue([{ libraryItemId: 'li_001', episodeId: null }])
    expect(store.playQueue).toHaveLength(1)
  })
  // ... more tests
})
```

**Step 2: Run**
```bash
npm test 2>&1 | tail -20
```
Expected: all tests pass.

**Step 3: Commit**
```bash
git add tests/
git commit -m "test(modernize): unit tests for all 4 Pinia stores"
```

---

### Task 8.3: Composable Unit Tests

**Files:**
- Create: `tests/unit/composables/useJumpLabel.test.ts`
- Create: `tests/unit/composables/useEventBus.test.ts`

**Step 1:** Test `useJumpLabel` — provide ref inputs, assert computed outputs.

**Step 2:** Test `useEventBus` — emit an event, verify listener receives it.

**Step 3: Run**
```bash
npm test 2>&1 | tail -20
```
Expected: all tests pass.

**Step 4: Commit**
```bash
git add tests/unit/composables/
git commit -m "test(modernize): unit tests for key composables"
```

---

## Final: Merge Gate Checklist

Before merging `modernize/nuxt3` → `master`, ALL of the following must pass:

- [ ] `npx tsc --noEmit` exits with code 0 (zero TS errors)
- [ ] `npx nuxi generate` completes successfully
- [ ] `npx cap sync android` completes without errors
- [ ] `cd android && ./gradlew --no-daemon assembleDebug` → `BUILD SUCCESSFUL`
- [ ] `cd android && ./gradlew --no-daemon staticAnalysis` passes
- [ ] `npm test` → all tests pass
- [ ] Manual smoke test on device: app launches, can connect to server, podcast home loads, player opens

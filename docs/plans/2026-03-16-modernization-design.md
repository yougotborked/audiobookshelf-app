# Modernization Design: Nuxt 3 + Vue 3 + TypeScript + Tailwind 4 + Pinia

**Date:** 2026-03-16
**Scope:** Full frontend modernization — Nuxt 2 → Nuxt 3, Vue 2 → Vue 3 Composition API, Vuex → Pinia, Tailwind 3 → 4, TypeScript everywhere, npm ecosystem alignment
**Branch strategy:** Single clean branch `modernize/nuxt3` — full parallel rewrite, merge when done

---

## 1. Scope

### In
- Nuxt 2 → Nuxt 3 (Vue 3, Vite, TypeScript, `<script setup>`)
- Vuex 3 → Pinia (4 store modules, typed)
- Tailwind CSS 3 → 4 (CSS-first config, Oxide engine)
- Full TypeScript (`lang="ts"` on all Vue files)
- Event bus `new Vue()` → `mitt` (typed events)
- All 10 plugins → Nuxt 3 `defineNuxtPlugin` + composables
- All 4 mixins → composables
- npm packages: `date-fns` 2→3, `vuedraggable` 2→4, `vue-toastification` 1→2, `v-click-outside` → `@vueuse/core`
- Remove: `@nuxtjs/axios`, `core-js`, `es6-promise-plugin`, `vuex`
- `@capacitor/cli` 6 → 7 (align with plugin versions)
- v-model API update: 15 components `value`/`input` → `modelValue`/`update:modelValue`
- Unit tests via `vitest` + `@nuxt/test-utils` for Pinia stores

### Out
- iOS (Android-only focus)
- Kotlin DSL migration (Android `build.gradle.kts`) — separate effort
- New features — this is a pure modernization pass
- Server-side rendering — stay SPA (`ssr: false`)

---

## 2. Architecture

### 2.1 Framework

```
Nuxt 3 (latest, ~3.14)
├── Vue 3.5+ with <script setup lang="ts">
├── Vite (replaces webpack — faster HMR, ESM native)
├── nuxt generate → static/ → Capacitor sync (same pipeline)
└── ssr: false (SPA, same as today)
```

**`nuxt.config.ts`** key settings:
```ts
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@vueuse/nuxt'],
  css: ['~/assets/tailwind.css', '~/assets/app.css'],
  runtimeConfig: { public: { version: '' } },
  capacitor: { /* handled via generate output dir */ },
  vite: { /* capacitor-friendly static output */ }
})
```

### 2.2 State Management: Pinia

Replace 4 Vuex modules with 4 typed Pinia stores:

| Vuex module | Pinia store | File |
|-------------|-------------|------|
| `store/index.js` | `useAppStore` | `stores/app.ts` |
| `store/globals.js` | `useGlobalsStore` | `stores/globals.ts` |
| `store/libraries.js` | `useLibrariesStore` | `stores/libraries.ts` |
| `store/user.js` | `useUserStore` | `stores/user.ts` |

Usage change:
```ts
// Before (Vuex)
this.$store.commit('setPlayQueue', queue)
this.$store.state.networkConnected

// After (Pinia)
const appStore = useAppStore()
appStore.setPlayQueue(queue)
appStore.networkConnected
```

### 2.3 Event Bus: mitt

Replace `new Vue()` event bus with `mitt` (200 bytes, typed):

```ts
// composables/useEventBus.ts
import mitt from 'mitt'

type Events = {
  'play-item': PlayItemPayload
  'close-modal': void
  'minimize-player': void
  'close-ebook': void
  'stream-progress': StreamProgressPayload
  // ... all events enumerated
}

const emitter = mitt<Events>()
export const useEventBus = () => emitter
```

Usage:
```ts
// Before
this.$eventBus.$emit('play-item', payload)
this.$eventBus.$on('play-item', handler)

// After
const bus = useEventBus()
bus.emit('play-item', payload)
bus.on('play-item', handler)
```

### 2.4 Plugins → Composables

All `this.$xxx` injections become auto-importable composables:

| Plugin (Nuxt 2) | Composable (Nuxt 3) | Notes |
|-----------------|---------------------|-------|
| `$db` | `useDb()` | PaperDB wrapper |
| `$localStore` | `useLocalStore()` | Preferences wrapper |
| `$nativeHttp` | `useNativeHttp()` | OkHttp / fetch bridge |
| `$toast` | `useToast()` | vue-toastification v2 |
| `$constants` | `useConstants()` or `import { ... } from '~/constants'` | Static, can be direct import |
| `$strings` | `useStrings()` | i18n strings object |
| `$platform` | `usePlatform()` | Capacitor platform detection |
| `$eventBus` | `useEventBus()` | mitt emitter (see §2.3) |
| `$hapticsImpact` | `useHaptics()` | Capacitor Haptics |
| `$store` | removed — Pinia stores used directly | |

`init.client.js` (mega-plugin) is split into:
- `plugins/01.capacitor.client.ts` — Capacitor app init + back button + deep links
- `plugins/02.socket.client.ts` — socket.io connection + reconnect logic
- `plugins/03.strings.ts` — `$strings` injection (Nuxt plugin provides via `useStrings()`)

### 2.5 Mixins → Composables

| Mixin | Composable |
|-------|-----------|
| `mixins/jumpLabel.js` | `composables/useJumpLabel.ts` |
| `mixins/autoPlaylistHelpers.js` | `composables/useAutoPlaylist.ts` |
| `mixins/bookshelfCardsHelpers.js` | `composables/useBookshelfCards.ts` |
| `mixins/cellularPermissionHelpers.js` | `composables/useCellularPermission.ts` |

### 2.6 Vue 3 Breaking Changes (mechanical, but must be systematic)

| Change | Count | Approach |
|--------|-------|---------|
| `value` prop + `$emit('input')` → `modelValue` + `update:modelValue` | 15 components | Update simultaneously with component port |
| `model: { prop, event }` option removed | 1 (ToggleSwitch) | Remove, use default |
| Options API → Composition API (`<script setup>`) | 125 files | Per-component during port |
| `this.$router` → `useRouter()` | Scattered | Per-component |
| `this.$route` → `useRoute()` | Scattered | Per-component |
| `beforeDestroy` → `onBeforeUnmount` | Scattered | Per-component |
| `destroyed` → `onUnmounted` | Scattered | Per-component |

No `.native` modifiers, no `.sync`, no filters, no `$children/$set/$delete` — codebase is already clean in these areas.

### 2.7 Tailwind CSS 4

**Config migration** — `tailwind.config.js` becomes a `@theme` block in CSS:

```css
/* assets/tailwind.css */
@import "tailwindcss";

@theme {
  /* M3 color tokens */
  --color-md-primary: rgb(var(--md-primary));
  --color-md-on-primary: rgb(var(--md-on-primary));
  /* ... all tokens from current tailwind.config.js theme.extend */

  /* Border radius */
  --radius-md-xs: var(--md-shape-xs);
  --radius-md-full: var(--md-shape-full);

  /* Typography */
  --font-size-md-title-l: 1.375rem;
  /* ... */
}
```

Breaking utility changes in Tailwind 4 to handle:
- `bg-opacity-*` → already using slash syntax (`/50`) ✅
- Shadow utilities: renamed — grep and fix
- `divide-*`, `ring-*` changes — check usage
- `content-['...']` arbitrary value syntax unchanged ✅
- Custom property consumption: `var(--x)` still works ✅

### 2.8 npm Package Changes

**Remove:**
```
nuxt@2            → nuxt@3 (latest)
vuex              → pinia + @pinia/nuxt
@nuxtjs/axios     → built-in $fetch
core-js           → Vite handles polyfills
es6-promise-plugin → obsolete
v-click-outside   → @vueuse/core onClickOutside
```

**Update:**
```
date-fns          2.x → 3.x (ESM, tree-shakeable)
vuedraggable      2.x → 4.x (Vue 3, @vueuse/gesture)
vue-toastification 1.x → 2.x (Vue 3)
@capacitor/cli    6.x → 7.x (align with plugins)
tailwindcss       3.x → 4.x
```

**Add:**
```
mitt              (event bus)
@vueuse/core      (onClickOutside + other utils)
@pinia/nuxt       (Pinia Nuxt module)
@nuxt/test-utils  (testing)
vitest            (unit tests)
```

**Keep (compatible):**
```
@capacitor/*      7.x ✅ (already latest)
socket.io-client  4.x ✅
fast-average-color 9.x ✅
epubjs            0.3.x ✅ (no Vue 3 version needed)
@teckel/vue-pdf   ✅
libarchive.js     ✅
```

---

## 3. Data Flow

```
Capacitor native layer
        ↕ (Capacitor bridge)
Nuxt 3 SPA (static, ssr: false)
  ├── pages/ (file-based routing)
  ├── components/ (auto-imported)
  ├── composables/ (auto-imported: useXxx)
  ├── stores/ (Pinia, auto-imported via @pinia/nuxt)
  ├── plugins/ (server/client setup)
  └── assets/ (tailwind.css, app.css)
        ↕ ($fetch / socket.io)
Audiobookshelf server
```

Playback flow (key path):
```
User taps "Play" → component calls bus.emit('play-item', {...})
→ AudioPlayer.vue listens, calls useNativeHttp() to open stream
→ Capacitor bridge → Android PlayerNotificationService
→ Media3 ExoPlayer handles audio
→ Progress updates via socket.io → Pinia appStore.updateProgress()
→ Reactive UI update
```

---

## 4. Error Handling

- API errors: `useNativeHttp()` wraps all calls, throws typed `NativeHttpError`; components handle via `try/catch` in async setup
- Socket disconnect: `plugins/02.socket.client.ts` handles reconnect; Pinia `appStore.socketConnected` reflects state
- Offline mode: existing strategy preserved — `appStore.networkConnected` / `serverReachable` guards
- Capacitor bridge failures: existing error patterns preserved in composables
- TypeScript: `strict: true` in `tsconfig.json` — type errors caught at build time

---

## 5. Testing Strategy

**Unit tests (new):**
- Framework: `vitest` + `@nuxt/test-utils`
- Coverage: all 4 Pinia stores (actions, getters, state mutations)
- Coverage: composables with business logic (`useJumpLabel`, `useAutoPlaylist`)
- Location: `tests/unit/stores/`, `tests/unit/composables/`

**Integration tests (keep):**
- Playwright screenshots — `scripts/screenshot.js` (real-server mode stays)
- Android Robolectric tests — unaffected by frontend changes

**Build gate:**
- `nuxt generate` must succeed (CI already validates this)
- `tsc --noEmit` added to CI for type checking
- Lint: `@nuxtjs/eslint-config-typescript` (replaces current config)

---

## 6. Phase Plan (Implementation Order)

### Phase 0 — Foundation (serial, ~8 tasks)
Must be done first; everything else depends on this.

| Task | Description |
|------|-------------|
| 0.1 | New branch `modernize/nuxt3`, scaffold Nuxt 3 (`nuxi init`), configure `nuxt.config.ts` for SPA + static |
| 0.2 | TypeScript setup (`tsconfig.json`, `strict: true`) |
| 0.3 | Tailwind 4 setup — CSS `@theme` config, migrate `tailwind.config.js` → CSS |
| 0.4 | Pinia stores — `stores/app.ts`, `stores/globals.ts`, `stores/libraries.ts`, `stores/user.ts` |
| 0.5 | `mitt` event bus — `composables/useEventBus.ts` with typed event map |
| 0.6 | Plugins — port all 10 plugins to Nuxt 3 + composables; split `init.client.js` |
| 0.7 | Mixins → composables (4 mixins) |
| 0.8 | npm package swap (`package.json` overhaul, install, verify build starts) |

### Phase 1 — App Shell (serial, ~5 tasks)
Core layout and player. Cannot parallelize with each other (shared state).

| Task | Description |
|------|-------------|
| 1.1 | `layouts/default.vue` + `layouts/blank.vue` |
| 1.2 | `components/app/Appbar.vue` |
| 1.3 | `components/app/SideDrawer.vue` |
| 1.4 | `components/app/AudioPlayer.vue` (**highest risk** — 1479 lines, complex lifecycle) |
| 1.5 | Smoke test: `nuxt generate` succeeds, Capacitor sync works |

### Phase 2 — UI & Widget Components (parallel agents OK)

| Task | Description |
|------|-------------|
| 2.1 | `components/ui/*` — 12 components (Btn, TextInput, Dropdown, etc.) |
| 2.2 | `components/widgets/*` — 8 components |

### Phase 3 — Cards & Covers (parallel agents OK)

| Task | Description |
|------|-------------|
| 3.1 | `components/cards/*` — 8 components |
| 3.2 | `components/covers/*` — 7 components |

### Phase 4 — Modals (parallel agents OK)

| Task | Description |
|------|-------------|
| 4.1 | `components/modals/*.vue` — top-level modals (~10 files) |
| 4.2 | `components/modals/bookmarks/`, `playlists/`, `rssfeeds/` — sub-modals (~8 files) |

### Phase 5 — Tables & Feature Components (parallel agents OK)

| Task | Description |
|------|-------------|
| 5.1 | `components/tables/**` — 12 components |
| 5.2 | `components/home/**` — 5 components (BookshelfNavBar, BookshelfToolbar, PodcastCatchUpFeed, etc.) |
| 5.3 | `components/bookshelf/**` — 8 components |
| 5.4 | `components/connection/`, `forms/`, `stats/`, `readers/` — ~10 components |

### Phase 6 — Pages (parallel agents OK within groups)

| Task | Description |
|------|-------------|
| 6.1 | `pages/index.vue`, `pages/connect.vue` (auth flow) |
| 6.2 | `pages/bookshelf.vue` + `pages/bookshelf/**` (~10 pages) |
| 6.3 | `pages/collection/`, `item/`, `localMedia/`, `media/`, `playlist/` (~10 pages) |
| 6.4 | `pages/account.vue`, `settings.vue`, `downloads.vue`, `downloading.vue`, `logs.vue`, `search.vue`, `stats.vue` |

### Phase 7 — Integration & Build (serial)

| Task | Description |
|------|-------------|
| 7.1 | Full `nuxt generate` pass — fix any remaining TS/import errors |
| 7.2 | Capacitor sync + Android `assembleDebug` build |
| 7.3 | Lint baseline regeneration (`./gradlew generateDebugLintBaseline`) |
| 7.4 | CI workflow update (`build-apk.yml`) — add `tsc --noEmit` step |

### Phase 8 — Tests

| Task | Description |
|------|-------------|
| 8.1 | Vitest setup + `@nuxt/test-utils` |
| 8.2 | Unit tests: 4 Pinia stores |
| 8.3 | Unit tests: key composables |

**Total: ~36 tasks across 8 phases**

---

## 7. Rollout / Migration Notes

- **Branch**: `modernize/nuxt3` — completely parallel to master, no partial merges
- **Merge gate**: All of Phase 7 must pass (clean build + Android APK) before merge
- **No Nuxt 2 compat layer**: This is a clean rewrite, not an incremental migration. Compat shims add complexity and technical debt.
- **Risk items**:
  - `AudioPlayer.vue` — plan for extra review time; consider splitting into `<AudioPlayerMini>` + `<AudioPlayerFullscreen>` sub-components during port
  - Tailwind 4 utility renames — run a grep for any changed names (shadows, rings) before declaring done
  - `socket.io-client` — verify event handler patterns work the same after splitting `init.client.js`
  - `date-fns` v3 has named-only exports (no default) — update all import statements
- **`cordova-plugin-screen-orientation`**: This is a Cordova plugin. Check if a Capacitor equivalent exists or if Capacitor handles orientation natively. Remove if unused.

---

## 8. Key File Mappings

```
store/index.js          → stores/app.ts
store/globals.js        → stores/globals.ts
store/libraries.js      → stores/libraries.ts
store/user.js           → stores/user.ts

plugins/init.client.js  → plugins/01.capacitor.client.ts
                          plugins/02.socket.client.ts
                          plugins/03.strings.ts
plugins/axios.js        → removed (@nuxtjs/axios gone; use $fetch)
plugins/db.js           → composables/useDb.ts
plugins/localStore.js   → composables/useLocalStore.ts
plugins/nativeHttp.js   → composables/useNativeHttp.ts
plugins/toast.js        → composables/useToast.ts
plugins/constants.js    → constants/index.ts (direct imports)
plugins/haptics.js      → composables/useHaptics.ts
plugins/i18n.js         → composables/useStrings.ts

mixins/jumpLabel.js     → composables/useJumpLabel.ts
mixins/autoPlaylistHelpers.js     → composables/useAutoPlaylist.ts
mixins/bookshelfCardsHelpers.js   → composables/useBookshelfCards.ts
mixins/cellularPermissionHelpers.js → composables/useCellularPermission.ts

tailwind.config.js      → assets/tailwind.css @theme block
nuxt.config.js          → nuxt.config.ts
```

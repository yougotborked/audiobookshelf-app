# Discover Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` to implement this plan.

**Goal:** Replace the redundant "Latest" tab and admin-only "Add Podcast" tab with a unified "Discover" tab that shows live trending podcasts (Podcast Index), keyword search (ABS iTunes proxy), and inline add-to-library for admins.

**Architecture:** New `pages/bookshelf/discover.vue` handles three states — empty/discovery (genre chips + Podcast Index trending), search results (ABS `/api/search/podcast`), and add flow (existing `NewPodcastForm`). A `composables/usePodcastIndex.ts` composable owns HMAC signing and the Podcast Index API call. The nav bar loses two entries and gains one visible to all users.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, Nuxt 3 auto-imports, Tailwind/MD3 tokens, Web Crypto API (sha1), Podcast Index REST API, ABS server REST API.

---

## Pre-requisites (manual — do before Task 1)

1. Register a free Podcast Index API key at https://api.podcastindex.org/
2. Note your **API Key** and **API Secret**
3. Create `.env` in the project root (if it doesn't exist) and add:
   ```
   PODCAST_INDEX_KEY=your_key_here
   PODCAST_INDEX_SECRET=your_secret_here
   ```

---

### Task 1: Add Podcast Index credentials to runtimeConfig

**Files:**
- Modify: `nuxt.config.ts`
- Create: `.env` (manual pre-req above)

**Step 1: Implement**

In `nuxt.config.ts`, extend `runtimeConfig.public` to include the Podcast Index credentials:

```ts
runtimeConfig: {
  public: {
    version: '0.12.0-beta',
    ANDROID_APP_URL: 'https://play.google.com/store/apps/details?id=com.audiobookshelf.app',
    IOS_APP_URL: '',
    PODCAST_INDEX_KEY: process.env.PODCAST_INDEX_KEY || '',
    PODCAST_INDEX_SECRET: process.env.PODCAST_INDEX_SECRET || '',
  }
},
```

**Step 2: Verify**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
grep -n "PODCAST_INDEX" nuxt.config.ts
```
Expected: 2 lines with `PODCAST_INDEX_KEY` and `PODCAST_INDEX_SECRET`.

**Step 3: Commit**
```bash
git add nuxt.config.ts .env
git commit -m "config: add Podcast Index API credentials to runtimeConfig"
```
> Note: add `.env` to `.gitignore` if not already present:
> ```bash
> grep -q '^\.env$' .gitignore || echo '.env' >> .gitignore
> ```

---

### Task 2: Add i18n strings

**Files:**
- Modify: `strings/en-us.json`

**Step 1: Implement**

Add these keys to `strings/en-us.json` (alphabetically within existing groups):

```json
"ButtonDiscover": "Discover",
"LabelInLibrary": "In Library",
"LabelTrending": "Trending",
"MessageDiscoverSearch": "Search podcasts...",
"MessageDiscoverEmpty": "Search for podcasts or browse trending below",
"MessageNoPodcastIndexKey": "Trending unavailable — Podcast Index key not configured",
```

**Step 2: Verify**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
node -e "const s = require('./strings/en-us.json'); ['ButtonDiscover','LabelInLibrary','LabelTrending','MessageDiscoverSearch','MessageDiscoverEmpty'].forEach(k => console.log(k, ':', s[k] || 'MISSING'))"
```
Expected: all 5 keys print their English values.

**Step 3: Commit**
```bash
git add strings/en-us.json
git commit -m "i18n: add Discover tab strings"
```

---

### Task 3: Create usePodcastIndex composable

**Files:**
- Create: `composables/usePodcastIndex.ts`

**Step 1: Implement**

```ts
// composables/usePodcastIndex.ts
const PODCAST_INDEX_BASE = 'https://api.podcastindex.org/api/1.0'

export interface PodcastIndexFeed {
  id: number
  url: string          // RSS feed URL
  title: string
  description: string
  author: string
  image: string
  artwork: string
  categories?: Record<string, string>
  explicit: boolean
  episodeCount: number
}

async function sha1Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message)
  const buf = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function buildPodcastIndexHeaders(apiKey: string, apiSecret: string) {
  const ts = Math.floor(Date.now() / 1000)
  const hash = await sha1Hex(`${apiKey}${apiSecret}${ts}`)
  return {
    'X-Auth-Key': apiKey,
    'X-Auth-Date': String(ts),
    Authorization: hash,
    'User-Agent': 'audiobookshelf-app/1.0',
  }
}

export function usePodcastIndex() {
  const config = useRuntimeConfig()
  const apiKey = config.public.PODCAST_INDEX_KEY as string
  const apiSecret = config.public.PODCAST_INDEX_SECRET as string

  const isConfigured = computed(() => !!apiKey && !!apiSecret)

  async function fetchTrending(options: { max?: number; category?: string; lang?: string } = {}): Promise<PodcastIndexFeed[]> {
    if (!apiKey || !apiSecret) return []

    const params = new URLSearchParams({
      max: String(options.max ?? 15),
      lang: options.lang ?? 'en',
    })
    if (options.category) params.set('cat', options.category)

    const headers = await buildPodcastIndexHeaders(apiKey, apiSecret)

    const res = await fetch(`${PODCAST_INDEX_BASE}/podcasts/trending?${params}`, { headers }).catch(() => null)
    if (!res?.ok) return []

    const data = (await res.json().catch(() => null)) as { feeds?: PodcastIndexFeed[] } | null
    return data?.feeds ?? []
  }

  return { isConfigured, fetchTrending }
}
```

**Step 2: Verify**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
npx tsc --noEmit 2>&1 | grep usePodcastIndex || echo "No TS errors for composable"
```

**Step 3: Commit**
```bash
git add composables/usePodcastIndex.ts
git commit -m "feat: add usePodcastIndex composable with HMAC auth and trending fetch"
```

---

### Task 4: Create discover.vue page

**Files:**
- Create: `pages/bookshelf/discover.vue`

**Step 1: Implement**

```vue
<template>
  <div class="w-full h-full flex flex-col overflow-hidden">

    <!-- Search bar -->
    <div class="px-4 pt-4 pb-2 shrink-0">
      <div class="relative">
        <span class="material-symbols absolute left-3 top-1/2 -translate-y-1/2 text-md-on-surface-variant text-xl pointer-events-none">search</span>
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="strings.MessageDiscoverSearch"
          class="w-full bg-md-surface-3 text-md-on-surface rounded-md-full pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-md-primary/50"
          @input="onSearchInput"
        />
        <button v-if="searchQuery" class="absolute right-3 top-1/2 -translate-y-1/2" @click="clearSearch">
          <span class="material-symbols text-md-on-surface-variant text-xl">close</span>
        </button>
      </div>
    </div>

    <!-- Genre chips -->
    <div class="px-3 pb-2 shrink-0 flex gap-2 overflow-x-auto no-scrollbar">
      <button
        v-for="genre in genres"
        :key="genre.label"
        class="shrink-0 px-3 py-1 rounded-md-full text-md-label-m border transition-colors"
        :class="activeGenre === genre.label
          ? 'bg-md-primary text-md-on-primary border-md-primary'
          : 'bg-transparent text-md-on-surface-variant border-md-outline-variant'"
        @click="selectGenre(genre)"
      >
        {{ genre.label }}
      </button>
    </div>

    <!-- Searching: results list -->
    <div v-if="isSearching" class="flex-1 overflow-y-auto">
      <div v-if="searchLoading" class="py-12 flex justify-center">
        <widgets-loading-spinner />
      </div>
      <p v-else-if="searchResults.length === 0 && searchQuery" class="text-center text-md-on-surface-variant py-8 text-sm">
        {{ strings.MessageNoPodcastsFound }}
      </p>
      <div v-for="podcast in searchResults" :key="podcast.feedUrl" class="border-b border-md-outline-variant/20">
        <podcast-result-card
          :podcast="podcast"
          :in-library="isInLibrary(podcast.feedUrl)"
          :show-add="userIsAdminOrUp"
          @add="startAddFlow(podcast)"
        />
      </div>
    </div>

    <!-- Discovery: trending + genre chips -->
    <div v-else class="flex-1 overflow-y-auto">

      <!-- Trending section -->
      <div class="px-4 pt-2 pb-1 flex items-center justify-between">
        <p class="text-md-label-l text-md-on-surface font-semibold">{{ strings.LabelTrending }}</p>
        <p v-if="!podcastIndex.isConfigured.value" class="text-xxs text-md-on-surface-variant">{{ strings.MessageNoPodcastIndexKey }}</p>
      </div>

      <div v-if="trendingLoading" class="py-8 flex justify-center">
        <widgets-loading-spinner />
      </div>
      <div v-else-if="!trendingResults.length" class="px-4 py-4 text-sm text-md-on-surface-variant">
        {{ podcastIndex.isConfigured.value ? 'No trending podcasts found.' : 'Configure Podcast Index key to see trending.' }}
      </div>
      <div v-else v-for="podcast in trendingResults" :key="podcast.url" class="border-b border-md-outline-variant/20">
        <podcast-result-card
          :podcast="toPodcastCard(podcast)"
          :in-library="isInLibrary(podcast.url)"
          :show-add="userIsAdminOrUp"
          @add="startAddFlow(toPodcastCard(podcast))"
        />
      </div>
    </div>

    <!-- Add flow overlay: feed confirmation + NewPodcastForm -->
    <div v-if="showAddFlow" class="absolute inset-0 bg-md-surface z-50 flex flex-col overflow-hidden">
      <div class="flex items-center px-2 h-16 shrink-0 border-b border-md-outline-variant/20">
        <button class="flex items-center" @click="cancelAddFlow">
          <span class="material-symbols text-2xl text-md-on-surface-variant">arrow_back</span>
          <p class="pl-2 uppercase text-sm font-semibold text-md-on-surface-variant">{{ strings.ButtonBack }}</p>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto py-2">
        <forms-new-podcast-form
          v-if="selectedPodcastFeed"
          :podcast-data="selectedPodcast"
          :podcast-feed-data="selectedPodcastFeed"
          v-model:processing="addProcessing"
        />
      </div>
    </div>

    <!-- Processing overlay -->
    <div v-if="addProcessing" class="absolute inset-0 bg-black/25 z-60 flex items-center justify-center">
      <ui-loading-indicator />
    </div>

  </div>
</template>

<script setup lang="ts">
const strings = useStrings()
const nativeHttp = useNativeHttp()
const toast = useToast()
const userStore = useUserStore()
const librariesStore = useLibrariesStore()
const podcastIndex = usePodcastIndex()

// ── State ────────────────────────────────────────────────────────────────────
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const searchLoading = ref(false)
const searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null)

const trendingResults = ref<any[]>([])
const trendingLoading = ref(false)
const activeGenre = ref<string | null>(null)

const libraryFeedUrls = ref<Set<string>>(new Set())

const showAddFlow = ref(false)
const selectedPodcast = ref<any>(null)
const selectedPodcastFeed = ref<any>(null)
const addProcessing = ref(false)

// ── Computed ─────────────────────────────────────────────────────────────────
const currentLibraryId = computed(() => librariesStore.currentLibraryId)
const userIsAdminOrUp = computed(() => userStore.getIsAdminOrUp)
const isSearching = computed(() => searchQuery.value.trim().length > 0)

// ── Genre definitions ─────────────────────────────────────────────────────────
const genres = [
  { label: 'All',         podcastIndexCat: undefined },
  { label: 'Comedy',      podcastIndexCat: 'Comedy' },
  { label: 'True Crime',  podcastIndexCat: 'True Crime' },
  { label: 'Technology',  podcastIndexCat: 'Technology' },
  { label: 'News',        podcastIndexCat: 'News' },
  { label: 'Science',     podcastIndexCat: 'Science' },
  { label: 'History',     podcastIndexCat: 'History' },
  { label: 'Sports',      podcastIndexCat: 'Sports' },
  { label: 'Business',    podcastIndexCat: 'Business' },
]

// ── In-library check ─────────────────────────────────────────────────────────
function isInLibrary(feedUrl?: string): boolean {
  if (!feedUrl) return false
  return libraryFeedUrls.value.has(feedUrl)
}

async function loadLibraryFeedUrls() {
  if (!currentLibraryId.value) return
  try {
    const res = await nativeHttp.get(`/api/libraries/${currentLibraryId.value}/items?minified=1&limit=0`) as any
    const items: any[] = res?.results ?? res?.items ?? []
    libraryFeedUrls.value = new Set(
      items
        .map((item: any) => item?.media?.metadata?.feedUrl as string | undefined)
        .filter(Boolean)
    )
  } catch {
    // non-fatal — "in library" badges just won't show
  }
}

// ── Trending ─────────────────────────────────────────────────────────────────
async function loadTrending(category?: string) {
  trendingLoading.value = true
  trendingResults.value = []
  trendingResults.value = await podcastIndex.fetchTrending({ max: 15, category })
  trendingLoading.value = false
}

function selectGenre(genre: { label: string; podcastIndexCat?: string }) {
  if (activeGenre.value === genre.label) {
    activeGenre.value = null
    loadTrending()
    return
  }
  activeGenre.value = genre.label === 'All' ? null : genre.label
  loadTrending(genre.podcastIndexCat)
}

// ── Search ───────────────────────────────────────────────────────────────────
function onSearchInput() {
  if (searchDebounce.value) clearTimeout(searchDebounce.value)
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }
  searchDebounce.value = setTimeout(() => doSearch(searchQuery.value.trim()), 400)
}

async function doSearch(term: string) {
  searchLoading.value = true
  try {
    const res = await nativeHttp.get(`/api/search/podcast?term=${encodeURIComponent(term)}`) as any[]
    searchResults.value = res ?? []
  } catch {
    searchResults.value = []
  }
  searchLoading.value = false
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
}

// ── Shape adapter: Podcast Index → card shape ────────────────────────────────
function toPodcastCard(feed: any) {
  return {
    feedUrl: feed.url,
    title: feed.title,
    artistName: feed.author,
    cover: feed.artwork || feed.image,
    genres: feed.categories ? Object.values(feed.categories) : [],
    trackCount: feed.episodeCount ?? null,
    explicit: feed.explicit,
  }
}

// ── Add flow ─────────────────────────────────────────────────────────────────
async function startAddFlow(podcast: any) {
  if (!podcast.feedUrl) {
    toast.error('Podcast has no feed URL')
    return
  }
  addProcessing.value = true
  try {
    const payload = await nativeHttp.post('/api/podcasts/feed', { rssFeed: podcast.feedUrl }) as any
    if (!payload) {
      toast.error('Failed to get podcast feed')
      return
    }
    selectedPodcast.value = podcast
    selectedPodcastFeed.value = payload.podcast
    showAddFlow.value = true
  } catch (err: any) {
    console.error('[Discover] feed check failed', err)
    toast.error('Failed to get podcast feed')
  } finally {
    addProcessing.value = false
  }
}

function cancelAddFlow() {
  showAddFlow.value = false
  selectedPodcast.value = null
  selectedPodcastFeed.value = null
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([
    loadLibraryFeedUrls(),
    loadTrending(),
  ])
})
</script>
```

> **Note:** This page references a `podcast-result-card` component created in Task 5. Create that component before building the page, or inline the card HTML directly here.

**Step 2: Verify template compiles**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
npx nuxi generate 2>&1 | tail -20
```
Expected: no `SyntaxError` or `unknown component` errors for discover.vue.

**Step 3: Commit**
```bash
git add pages/bookshelf/discover.vue
git commit -m "feat: add Discover tab page with search, trending, and add flow"
```

---

### Task 5: Create PodcastResultCard component

**Files:**
- Create: `components/podcast/ResultCard.vue`

**Step 1: Implement**

```vue
<template>
  <div class="flex items-start gap-3 px-4 py-3 active:bg-md-surface-3 transition-colors">
    <!-- Artwork -->
    <div class="h-14 w-14 shrink-0 rounded-md overflow-hidden bg-md-surface-3">
      <img v-if="podcast.cover" :src="podcast.cover" class="h-full w-full object-cover" loading="lazy" />
      <span v-else class="material-symbols text-md-on-surface-variant text-3xl flex h-full items-center justify-center">podcasts</span>
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-semibold text-md-on-surface truncate leading-snug">{{ podcast.title }}</p>
      <p class="text-xs text-md-on-surface-variant truncate">{{ podcast.artistName }}</p>
      <p v-if="podcast.genres?.length" class="text-xxs text-md-on-surface-variant/70 truncate mt-0.5">{{ podcast.genres.slice(0, 3).join(' · ') }}</p>
    </div>

    <!-- Action -->
    <div class="shrink-0 flex flex-col items-end gap-1 self-center">
      <span v-if="inLibrary"
        class="text-xxs px-2 py-0.5 rounded-md-full bg-md-secondary-container text-md-on-secondary-container font-medium">
        {{ strings.LabelInLibrary }}
      </span>
      <button v-else-if="showAdd"
        class="text-xxs px-3 py-1 rounded-md-full bg-md-primary text-md-on-primary font-semibold active:opacity-75 transition-opacity"
        @click.stop="$emit('add')">
        {{ strings.ButtonAdd }}
      </button>
      <p v-if="podcast.trackCount != null" class="text-xxs text-md-on-surface-variant">{{ podcast.trackCount }} ep</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const strings = useStrings()

defineProps<{
  podcast: {
    feedUrl?: string
    title?: string
    artistName?: string
    cover?: string
    genres?: string[]
    trackCount?: number | null
    explicit?: boolean
  }
  inLibrary: boolean
  showAdd: boolean
}>()

defineEmits<{ add: [] }>()
</script>
```

**Step 2: Verify**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
npx tsc --noEmit 2>&1 | grep ResultCard || echo "No TS errors for ResultCard"
```

**Step 3: Commit**
```bash
git add components/podcast/ResultCard.vue
git commit -m "feat: add PodcastResultCard component"
```

---

### Task 6: Update BookshelfNavBar — swap "Latest" and "Add Podcast" for "Discover"

**Files:**
- Modify: `components/home/BookshelfNavBar.vue`

**Step 1: Implement**

Replace the podcast `navItems` block (currently lines ~66–73):

```ts
// BEFORE
navItems = [
  { to: '/bookshelf', routeName: 'bookshelf', iconPack: 'abs-icons', icon: 'home', text: strings.ButtonHome },
  { to: '/bookshelf/latest', routeName: 'bookshelf-latest', iconPack: 'abs-icons', icon: 'list', text: strings.ButtonLatest },
  { to: '/bookshelf/library', routeName: 'bookshelf-library', iconPack: 'abs-icons', icon: currentLibraryIcon.value, text: strings.ButtonLibrary }
]
if (userIsAdminOrUp.value) {
  navItems.push({ to: '/bookshelf/add-podcast', routeName: 'bookshelf-add-podcast', iconPack: 'material-symbols', icon: 'podcasts', text: strings.ButtonAdd })
}
```

```ts
// AFTER
navItems = [
  { to: '/bookshelf', routeName: 'bookshelf', iconPack: 'abs-icons', icon: 'home', text: strings.ButtonHome },
  { to: '/bookshelf/discover', routeName: 'bookshelf-discover', iconPack: 'material-symbols', icon: 'explore', text: strings.ButtonDiscover },
  { to: '/bookshelf/library', routeName: 'bookshelf-library', iconPack: 'abs-icons', icon: currentLibraryIcon.value, text: strings.ButtonLibrary }
]
```

**Step 2: Verify**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
grep -n "discover\|latest\|add-podcast" components/home/BookshelfNavBar.vue
```
Expected: only `discover` entries, no `latest` or `add-podcast`.

**Step 3: Commit**
```bash
git add components/home/BookshelfNavBar.vue
git commit -m "feat: replace Latest/Add-Podcast nav tabs with Discover tab for all users"
```

---

### Task 7: Delete obsolete pages

**Files:**
- Delete: `pages/bookshelf/latest.vue`
- Delete: `pages/bookshelf/add-podcast.vue`

**Step 1: Implement**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
rm pages/bookshelf/latest.vue pages/bookshelf/add-podcast.vue
```

**Step 2: Verify no remaining references**
```bash
grep -rn "bookshelf/latest\|bookshelf-latest\|bookshelf/add-podcast\|bookshelf-add-podcast" \
  --include="*.vue" --include="*.ts" \
  /home/lab.abork.co/abork/workspace/audiobookshelf-app/pages \
  /home/lab.abork.co/abork/workspace/audiobookshelf-app/components \
  /home/lab.abork.co/abork/workspace/audiobookshelf-app/composables \
  /home/lab.abork.co/abork/workspace/audiobookshelf-app/stores
```
Expected: no output (zero references remaining).

**Step 3: Commit**
```bash
git add -A
git commit -m "chore: remove obsolete latest.vue and add-podcast.vue pages"
```

---

### Task 8: Hide toolbar on Discover page (bookshelf layout)

**Files:**
- Modify: `pages/bookshelf.vue`

**Step 1: Check current toolbar hide logic**

The bookshelf layout already hides the toolbar on certain routes. Find the condition and add `discover`:

```bash
grep -n "add-podcast\|latest\|toolbar\|showToolbar" \
  /home/lab.abork.co/abork/workspace/audiobookshelf-app/pages/bookshelf.vue | head -20
```

**Step 2: Implement**

In `pages/bookshelf.vue` lines 14–17, replace the three computed refs:

```ts
// BEFORE:
const hideToolbar = computed(() => isHome.value || isLatest.value || isPodcastSearch.value)
const isHome = computed(() => route.name === 'bookshelf')
const isLatest = computed(() => route.name === 'bookshelf-latest')
const isPodcastSearch = computed(() => route.name === 'bookshelf-add-podcast')

// AFTER:
const hideToolbar = computed(() => isHome.value || isDiscover.value)
const isHome = computed(() => route.name === 'bookshelf')
const isDiscover = computed(() => route.name === 'bookshelf-discover')
```

**Step 3: Verify**
```bash
grep -n "discover\|latest\|add-podcast" /home/lab.abork.co/abork/workspace/audiobookshelf-app/pages/bookshelf.vue
```
Expected: `bookshelf-discover` present, `bookshelf-latest` and `bookshelf-add-podcast` absent.

**Step 4: Commit**
```bash
git add pages/bookshelf.vue
git commit -m "fix: hide toolbar on Discover page to match Home layout"
```

---

### Task 9: End-to-end smoke test

**Step 1: Build**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
npm run build 2>&1 | tail -30
```
Expected: build completes with no errors.

**Step 2: Check for broken imports**
```bash
npx tsc --noEmit 2>&1 | head -40
```
Expected: 0 type errors related to new files.

**Step 3: Lint**
```bash
npx nuxi lint 2>&1 | grep -E "error|warn" | head -20
```
Expected: no errors in `discover.vue`, `usePodcastIndex.ts`, or `ResultCard.vue`.

**Step 4: Commit (if clean)**
```bash
git add -A
git commit -m "test: verify Discover tab build and lint clean"
```

---

## Rollout Notes

- **Podcast Index key is optional at runtime:** if `PODCAST_INDEX_KEY` is empty, `usePodcastIndex.fetchTrending` returns `[]` immediately and the UI shows a fallback message. The search path (ABS server) still works fully.
- **"In Library" check** uses the `/api/libraries/{id}/items?minified=1&limit=0` endpoint. On large libraries this may be slow; the check is non-blocking (page renders while it fetches).
- **Non-admin users** see the full Discover tab but no "Add" buttons — they can browse and search podcasts freely.
- **Old routes** (`/bookshelf/latest`, `/bookshelf/add-podcast`) will 404 after deletion; no redirects needed as they were never deep-linked externally.

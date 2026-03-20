<template>
  <div class="w-full h-full flex flex-col overflow-hidden relative">

    <!-- Search bar -->
    <div class="px-4 pt-4 pb-2 shrink-0">
      <div class="relative">
        <span class="material-symbols absolute left-3 top-1/2 -translate-y-1/2 text-md-on-surface-variant text-xl pointer-events-none">search</span>
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="strings.MessageDiscoverSearch"
          class="w-full bg-md-surface-3 text-md-on-surface rounded-md-full pl-10 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-md-primary/50"
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

    <!-- Search results -->
    <div v-if="isSearching" class="flex-1 overflow-y-auto">
      <div v-if="searchLoading" class="py-12 flex justify-center">
        <widgets-loading-spinner />
      </div>
      <p v-else-if="!searchResults.length && searchQuery" class="text-center text-md-on-surface-variant py-8 text-sm">
        {{ strings.MessageNoPodcastsFound }}
      </p>
      <template v-else>
        <div v-for="podcast in searchResults" :key="podcast.feedUrl" class="border-b border-md-outline-variant/20">
          <podcast-result-card
            :podcast="podcast"
            :in-library="isInLibrary(podcast.feedUrl)"
            :show-add="userIsAdminOrUp"
            @add="startAddFlow(podcast)"
          />
        </div>
      </template>
    </div>

    <!-- Discovery: trending -->
    <div v-else class="flex-1 overflow-y-auto">
      <div class="px-4 pt-2 pb-1 flex items-center justify-between shrink-0">
        <p class="text-md-label-l text-md-on-surface font-semibold">{{ strings.LabelTrending }}</p>
        <p v-if="!podcastIndexConfigured" class="text-xxs text-md-on-surface-variant opacity-60">No API key configured</p>
      </div>

      <div v-if="trendingLoading" class="py-8 flex justify-center">
        <widgets-loading-spinner />
      </div>
      <p v-else-if="!trendingResults.length" class="px-4 py-4 text-sm text-md-on-surface-variant">
        {{ podcastIndexConfigured ? 'No trending podcasts found.' : strings.MessageDiscoverEmpty }}
      </p>
      <template v-else>
        <div v-for="feed in trendingResults" :key="feed.url" class="border-b border-md-outline-variant/20">
          <podcast-result-card
            :podcast="toPodcastCard(feed)"
            :in-library="isInLibrary(feed.url)"
            :show-add="userIsAdminOrUp"
            @add="startAddFlow(toPodcastCard(feed))"
          />
        </div>
      </template>
    </div>

    <!-- Add flow overlay -->
    <div v-if="showAddFlow" class="absolute inset-0 bg-md-surface z-50 flex flex-col overflow-hidden">
      <div class="flex items-center px-2 h-16 shrink-0 border-b border-md-outline-variant/20">
        <button class="flex items-center" @click="cancelAddFlow">
          <span class="material-symbols text-2xl text-md-on-surface-variant">arrow_back</span>
          <p class="pl-2 uppercase text-sm font-semibold text-md-on-surface-variant leading-4 pb-px">{{ strings.ButtonBack }}</p>
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
    <div v-if="addProcessing" class="absolute inset-0 bg-black/25 z-60 flex items-center justify-center pointer-events-auto">
      <ui-loading-indicator />
    </div>

  </div>
</template>

<script setup lang="ts">
import type { PodcastIndexFeed } from '~/composables/usePodcastIndex'

const strings = useStrings()
const nativeHttp = useNativeHttp()
const toast = useToast()
const userStore = useUserStore()
const librariesStore = useLibrariesStore()
const { isConfigured, fetchTrending } = usePodcastIndex()

// ── State ─────────────────────────────────────────────────────────────────────
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const searchLoading = ref(false)
const searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null)

const trendingResults = ref<PodcastIndexFeed[]>([])
const trendingLoading = ref(false)
const activeGenre = ref<string | null>(null)

const libraryFeedUrls = ref<Set<string>>(new Set())

const showAddFlow = ref(false)
const selectedPodcast = ref<any>(null)
const selectedPodcastFeed = ref<any>(null)
const addProcessing = ref(false)

// ── Computed ──────────────────────────────────────────────────────────────────
const currentLibraryId = computed(() => librariesStore.currentLibraryId)
const userIsAdminOrUp = computed(() => userStore.getIsAdminOrUp)
const isSearching = computed(() => searchQuery.value.trim().length > 0)
const podcastIndexConfigured = computed(() => isConfigured.value)

// ── Genres ────────────────────────────────────────────────────────────────────
const genres = [
  { label: 'All',         cat: undefined },
  { label: 'Comedy',      cat: 'Comedy' },
  { label: 'True Crime',  cat: 'True Crime' },
  { label: 'Technology',  cat: 'Technology' },
  { label: 'News',        cat: 'News' },
  { label: 'Science',     cat: 'Science' },
  { label: 'History',     cat: 'History' },
  { label: 'Sports',      cat: 'Sports' },
  { label: 'Business',    cat: 'Business' },
]

// ── In-library ────────────────────────────────────────────────────────────────
function isInLibrary(feedUrl?: string) {
  return !!feedUrl && libraryFeedUrls.value.has(feedUrl)
}

async function loadLibraryFeedUrls() {
  if (!currentLibraryId.value) return
  try {
    const res = await nativeHttp.get(`/api/libraries/${currentLibraryId.value}/items?minified=1&limit=0`) as any
    const items: any[] = res?.results ?? res?.items ?? []
    libraryFeedUrls.value = new Set(
      items
        .map((item: any) => item?.media?.metadata?.feedUrl as string | undefined)
        .filter(Boolean) as string[]
    )
  } catch {
    // non-fatal
  }
}

// ── Trending ──────────────────────────────────────────────────────────────────
async function loadTrending(category?: string) {
  trendingLoading.value = true
  trendingResults.value = await fetchTrending({ max: 15, category })
  trendingLoading.value = false
}

function selectGenre(genre: { label: string; cat?: string }) {
  const newGenre = genre.label === 'All' ? null : genre.label
  if (activeGenre.value === newGenre) {
    activeGenre.value = null
    loadTrending()
    return
  }
  activeGenre.value = newGenre
  loadTrending(genre.cat)
}

// ── Search ────────────────────────────────────────────────────────────────────
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
    searchResults.value = Array.isArray(res) ? res : []
  } catch {
    searchResults.value = []
  }
  searchLoading.value = false
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  if (searchDebounce.value) clearTimeout(searchDebounce.value)
}

// ── Shape adapter: Podcast Index feed → card shape ────────────────────────────
function toPodcastCard(feed: PodcastIndexFeed) {
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

// ── Add flow ──────────────────────────────────────────────────────────────────
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

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  loadLibraryFeedUrls()
  loadTrending()
})
</script>

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
        <div v-for="podcast in searchResults" :key="podcast.feedUrl" class="border-b border-md-outline-variant/20" @click="onCardClick(podcast)">
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
        <div v-for="feed in trendingResults" :key="feed.url" class="border-b border-md-outline-variant/20" @click="onCardClick(toPodcastCard(feed))">
          <podcast-result-card
            :podcast="toPodcastCard(feed)"
            :in-library="isInLibrary(feed.url)"
            :show-add="userIsAdminOrUp"
            @add.stop="startAddFlow(toPodcastCard(feed))"
          />
        </div>
      </template>
    </div>

    <!-- Podcast detail preview overlay (all users) -->
    <div v-if="showPreview && previewPodcast" class="absolute inset-0 bg-md-surface-0 z-50 flex flex-col overflow-hidden">
      <div class="flex items-center px-2 h-16 shrink-0 border-b border-md-outline-variant/20">
        <button class="flex items-center" @click="closePreview">
          <span class="material-symbols text-2xl text-md-on-surface-variant">arrow_back</span>
          <p class="pl-2 uppercase text-sm font-semibold text-md-on-surface-variant leading-4 pb-px">{{ strings.ButtonBack }}</p>
        </button>
      </div>

      <!-- Loading state -->
      <div v-if="previewLoading" class="flex-1 flex items-center justify-center">
        <ui-loading-indicator />
      </div>

      <div v-else class="flex-1 overflow-y-auto">
        <!-- Header: artwork + meta -->
        <div class="flex gap-4 px-4 py-5">
          <div class="h-24 w-24 shrink-0 rounded-md-md overflow-hidden bg-md-surface-3">
            <img v-if="previewPodcast.cover" :src="previewPodcast.cover" class="h-full w-full object-cover" />
            <div v-else class="h-full w-full flex items-center justify-center">
              <span class="material-symbols text-md-on-surface-variant text-4xl">podcasts</span>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-md-title-m font-semibold text-md-on-surface leading-snug">{{ previewPodcast.title }}</p>
            <p class="text-sm text-md-on-surface-variant mt-1">{{ previewPodcast.artistName }}</p>
            <p v-if="previewPodcast.genres?.length" class="text-xs text-md-on-surface-variant/70 mt-1">{{ previewPodcast.genres.slice(0, 3).join(' · ') }}</p>
            <div class="flex items-center gap-2 mt-2 flex-wrap">
              <span v-if="isInLibrary(previewPodcast.feedUrl)" class="text-xxs px-2 py-0.5 rounded-md-full bg-md-secondary-container text-md-on-secondary-container font-medium">{{ strings.LabelInLibrary }}</span>
              <span v-if="previewEpisodes.length" class="text-xs text-md-on-surface-variant">{{ previewEpisodes.length }} ep</span>
            </div>
          </div>
        </div>

        <!-- Add to Library button (admins only) -->
        <div v-if="userIsAdminOrUp" class="px-4 pb-3">
          <button class="w-full py-2.5 rounded-md-full bg-md-primary text-md-on-primary text-md-label-l font-semibold active:opacity-75 transition-opacity" @click="startAddFlowFromPreview">
            {{ strings.ButtonAdd }} to Library
          </button>
        </div>

        <!-- Description -->
        <div v-if="previewDescription" class="px-4 pb-4">
          <p class="text-md-label-s text-md-on-surface-variant uppercase tracking-wide mb-1">{{ strings.LabelDescription }}</p>
          <p class="text-sm text-md-on-surface leading-relaxed line-clamp-5" v-html="previewDescription" />
        </div>

        <!-- Episodes -->
        <div v-if="previewEpisodes.length" class="pb-4">
          <p class="px-4 text-md-label-s text-md-on-surface-variant uppercase tracking-wide mb-1">{{ strings.LabelEpisodes }}</p>
          <div v-for="ep in previewEpisodes" :key="ep.enclosureUrl || ep.title" class="px-4 py-3 border-b border-md-outline-variant/20">
            <p class="text-sm font-medium text-md-on-surface leading-snug">{{ ep.title }}</p>
            <div class="flex items-center gap-3 mt-1">
              <p v-if="ep.publishedAt" class="text-xs text-md-on-surface-variant">{{ $dateDistanceFromNow(ep.publishedAt) }}</p>
              <p v-if="ep.duration" class="text-xs text-md-on-surface-variant">{{ $elapsedPretty(ep.duration) }}</p>
            </div>
          </div>
        </div>
      </div>
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

const showPreview = ref(false)
const previewPodcast = ref<any>(null)
const previewLoading = ref(false)
const previewDescription = ref('')
const previewEpisodes = ref<any[]>([])

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
    const res = await nativeHttp.get(`/api/libraries/${currentLibraryId.value}/items?minified=1&limit=0`, { connectTimeout: 10000 }) as any
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
    const res = await nativeHttp.get(`/api/search/podcast?term=${encodeURIComponent(term)}`, { connectTimeout: 10000 }) as any[]
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
    const payload = await nativeHttp.post('/api/podcasts/feed', { rssFeed: podcast.feedUrl }, { connectTimeout: 10000 }) as any
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

async function onCardClick(podcast: any) {
  previewPodcast.value = podcast
  previewDescription.value = ''
  previewEpisodes.value = []
  showPreview.value = true

  if (!podcast.feedUrl) return
  previewLoading.value = true
  try {
    const payload = await nativeHttp.post('/api/podcasts/feed', { rssFeed: podcast.feedUrl }, { connectTimeout: 10000 }) as any
    if (payload?.podcast) {
      const feed = payload.podcast
      const meta = (feed.metadata as Record<string, unknown>) || {}
      previewDescription.value = (meta.descriptionPlain as string) || (meta.description as string) || ''
      previewEpisodes.value = (feed.episodes as any[]) || []
    }
  } catch {
    // non-fatal — show basic info without feed details
  } finally {
    previewLoading.value = false
  }
}

function closePreview() {
  showPreview.value = false
  previewPodcast.value = null
  previewDescription.value = ''
  previewEpisodes.value = []
}

async function startAddFlowFromPreview() {
  const podcast = previewPodcast.value
  closePreview()
  await startAddFlow(podcast)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  loadLibraryFeedUrls()
  loadTrending()
})
</script>

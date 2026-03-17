<template>
  <div class="w-full h-full relative overflow-hidden">
    <template v-if="!showSelectedFeed">
      <div class="w-full mx-auto h-20 flex items-center px-2">
        <form class="w-full" @submit.prevent="submit">
          <ui-text-input v-model="searchInput" :disabled="processing || !socketConnected" :placeholder="strings.MessagePodcastSearchField" text-size="sm" />
        </form>
      </div>

      <div v-if="!socketConnected" class="w-full text-center py-6">
        <p class="text-lg text-error">{{ strings.MessageNoNetworkConnection }}</p>
      </div>
      <div v-else class="w-full mx-auto pb-2 overflow-y-auto overflow-x-hidden h-[calc(100%-85px)]">
        <p v-if="termSearched && !results.length && !processing" class="text-center text-xl">{{ strings.MessageNoPodcastsFound }}</p>
        <template v-for="podcast in results" :key="podcast.id">
          <div class="p-2 border-b border-fg border-opacity-10" @click="selectPodcast(podcast)">
            <div class="flex">
              <div class="w-8 min-w-8 py-1">
                <div class="h-8 w-full bg-md-surface-3">
                  <img v-if="podcast.cover" :src="podcast.cover" class="h-full w-full" />
                </div>
              </div>
              <div class="flex-grow pl-2">
                <p class="text-xs text-md-on-surface whitespace-nowrap truncate">{{ podcast.artistName }}</p>
                <p class="text-xxs text-md-on-surface leading-5">{{ podcast.trackCount }} {{ strings.HeaderEpisodes }}</p>
              </div>
            </div>

            <p class="text-sm text-md-on-surface mb-1">{{ podcast.title }}</p>
            <p class="text-xs text-md-on-surface-variant leading-5">{{ podcast.genres.join(', ') }}</p>
          </div>
        </template>
      </div>
    </template>
    <template v-else>
      <div class="flex items-center px-2 h-16">
        <div class="flex items-center" @click="clearSelected">
          <span class="material-symbols text-2xl text-md-on-surface-variant">arrow_back</span>
          <p class="pl-2 uppercase text-sm font-semibold text-md-on-surface-variant leading-4 pb-px">{{ strings.ButtonBack }}</p>
        </div>
      </div>

      <div class="w-full py-2 overflow-y-auto overflow-x-hidden h-[calc(100%-69px)]">
        <forms-new-podcast-form :podcast-data="selectedPodcast" :podcast-feed-data="selectedPodcastFeed" :processing.sync="processing" />
      </div>
    </template>

    <div v-show="processing" class="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-25 z-40">
      <ui-loading-indicator />
    </div>
  </div>
</template>

<script setup lang="ts">
const strings = useStrings()
const eventBus = useEventBus()
const nativeHttp = useNativeHttp()
const toast = useToast()
const router = useRouter()

const librariesStore = useLibrariesStore()
const appStore = useAppStore()

const searchInput = ref('')
const termSearched = ref<string | false>(false)
const processing = ref(false)
const results = ref<any[]>([])
const selectedPodcastFeed = ref<any>(null)
const selectedPodcast = ref<any>(null)
const showSelectedFeed = ref(false)

const socketConnected = computed(() => appStore.socketConnected)

function clearSelected() {
  selectedPodcastFeed.value = null
  selectedPodcast.value = null
  showSelectedFeed.value = false
}

function submit() {
  if (!searchInput.value) return

  if (searchInput.value.startsWith('http:') || searchInput.value.startsWith('https:')) {
    termSearched.value = ''
    results.value = []
    checkRSSFeed(searchInput.value)
  } else {
    submitSearch(searchInput.value)
  }
}

async function checkRSSFeed(rssFeed: string) {
  processing.value = true
  const payload = await nativeHttp.post(`/api/podcasts/feed`, { rssFeed }).catch((error: any) => {
    console.error('Failed to get feed', error)
    toast.error('Failed to get podcast feed')
    return null
  })
  processing.value = false
  if (!payload) return

  const typedPayload = payload as Record<string, unknown>
  selectedPodcastFeed.value = typedPayload.podcast
  selectedPodcast.value = null
  showSelectedFeed.value = true
}

async function submitSearch(term: string) {
  processing.value = true
  termSearched.value = ''
  const res = await nativeHttp.get(`/api/search/podcast?term=${encodeURIComponent(term)}`).catch((error: any) => {
    console.error('Search request failed', error)
    return []
  })
  console.log('Got results', res)
  results.value = res as any[]
  termSearched.value = term
  processing.value = false
}

async function selectPodcast(podcast: any) {
  console.log('Selected podcast', podcast)
  if (!podcast.feedUrl) {
    toast.error('Invalid podcast - no feed')
    return
  }
  processing.value = true
  const payload = await nativeHttp.post(`/api/podcasts/feed`, { rssFeed: podcast.feedUrl }).catch((error: any) => {
    console.error('Failed to get feed', error)
    toast.error('Failed to get podcast feed')
    return null
  })
  processing.value = false
  if (!payload) return

  const typedPayload2 = payload as Record<string, unknown>
  selectedPodcastFeed.value = typedPayload2.podcast
  selectedPodcast.value = podcast
  showSelectedFeed.value = true
  console.log('Got podcast feed', typedPayload2.podcast)
}

function libraryChanged() {
  const libraryMediaType = librariesStore.getCurrentLibraryMediaType
  if (libraryMediaType !== 'podcast') {
    router.replace('/bookshelf')
  }
}

onMounted(() => {
  eventBus.on('library-changed', libraryChanged)
})

onBeforeUnmount(() => {
  eventBus.off('library-changed', libraryChanged)
})
</script>

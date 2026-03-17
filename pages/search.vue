<template>
  <div class="w-full h-full">
    <div class="px-4 py-6">
      <ui-text-input ref="input" v-model="search" @input="updateSearch" borderless :placeholder="$strings.ButtonSearch" bg="white bg-opacity-10" rounded="md" prepend-icon="search" text-size="base" clearable class="w-full text-lg" />
    </div>
    <div class="w-full overflow-x-hidden overflow-y-auto search-content px-4" @click.stop>
      <div v-show="isFetching" class="w-full py-8 flex justify-center">
        <p class="text-lg text-fg-muted">{{ $strings.MessageFetching }}</p>
      </div>
      <div v-if="!isFetching && lastSearch && !totalResults" class="w-full py-8 flex justify-center">
        <p class="text-lg text-fg-muted">{{ $strings.MessageNoItemsFound }}</p>
      </div>
      <p v-if="bookResults.length" class="font-semibold text-sm mb-1">{{ $strings.LabelBooks }}</p>
      <template v-for="item in bookResults">
        <div :key="item.libraryItem.id" class="w-full h-16 py-1">
          <nuxt-link :to="`/item/${item.libraryItem.id}`">
            <cards-item-search-card :library-item="item.libraryItem" :search="lastSearch" />
          </nuxt-link>
        </div>
      </template>

      <p v-if="podcastResults.length" class="uppercase text-xs text-fg-muted my-1 px-1 font-semibold">{{ $strings.LabelPodcasts }}</p>
      <template v-for="item in podcastResults">
        <div :key="item.libraryItem.id" class="text-fg select-none relative py-1">
          <nuxt-link :to="`/item/${item.libraryItem.id}`">
            <cards-item-search-card :library-item="item.libraryItem" :search="lastSearch" />
          </nuxt-link>
        </div>
      </template>

      <p v-if="seriesResults.length" class="font-semibold text-sm mb-1 mt-2">{{ $strings.LabelSeries }}</p>
      <template v-for="seriesResult in seriesResults">
        <div :key="seriesResult.series.id" class="w-full h-16 py-1">
          <nuxt-link :to="`/bookshelf/series/${seriesResult.series.id}`">
            <cards-series-search-card :series="seriesResult.series" :book-items="seriesResult.books" />
          </nuxt-link>
        </div>
      </template>

      <p v-if="authorResults.length" class="font-semibold text-sm mb-1 mt-2">{{ $strings.LabelAuthors }}</p>
      <template v-for="authorResult in authorResults">
        <div :key="authorResult.id" class="w-full h-14 py-1">
          <nuxt-link :to="`/bookshelf/library?filter=authors.${$encode(authorResult.id)}`">
            <cards-author-search-card :author="authorResult" />
          </nuxt-link>
        </div>
      </template>

      <p v-if="narratorResults.length" class="font-semibold text-sm mb-1 mt-2">{{ $strings.LabelNarrators }}</p>
      <template v-for="narrator in narratorResults">
        <div :key="narrator.name" class="w-full h-14 py-1">
          <nuxt-link :to="`/bookshelf/library?filter=narrators.${$encode(narrator.name)}`">
            <cards-narrator-search-card :narrator="narrator.name" />
          </nuxt-link>
        </div>
      </template>

      <p v-if="tagResults.length" class="font-semibold text-sm mb-1 mt-2">{{ $strings.LabelTags }}</p>
      <template v-for="tag in tagResults">
        <div :key="tag.name" class="w-full h-14 py-1">
          <nuxt-link :to="`/bookshelf/library?filter=tags.${$encode(tag.name)}`">
            <cards-tag-search-card :tag="tag.name" />
          </nuxt-link>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLibrariesStore } from '~/stores/libraries'
import { useGlobalsStore } from '~/stores/globals'

const librariesStore = useLibrariesStore()
const globalsStore = useGlobalsStore()
const nativeHttp = useNativeHttp()

const search = ref<string | null>(null)
const searchTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const lastSearch = ref<string | null>(null)
const isFetching = ref(false)
const bookResults = ref<unknown[]>([])
const podcastResults = ref<unknown[]>([])
const seriesResults = ref<unknown[]>([])
const authorResults = ref<unknown[]>([])
const narratorResults = ref<unknown[]>([])
const tagResults = ref<unknown[]>([])

const inputRef = ref<{ focus: () => void } | null>(null)

const currentLibraryId = computed(() => librariesStore.currentLibraryId)
const totalResults = computed(
  () => bookResults.value.length + seriesResults.value.length + authorResults.value.length + podcastResults.value.length + narratorResults.value.length + tagResults.value.length
)

async function runSearch(value: string | null) {
  if (isFetching.value && lastSearch.value === value) return

  lastSearch.value = value
  globalsStore.lastSearch = value

  if (!lastSearch.value) {
    bookResults.value = []
    podcastResults.value = []
    seriesResults.value = []
    authorResults.value = []
    narratorResults.value = []
    tagResults.value = []
    return
  }
  isFetching.value = true
  const results = (await nativeHttp.get(`/api/libraries/${currentLibraryId.value}/search?q=${value}&limit=5`).catch((error: Error) => {
    console.error('Search error', error)
    return null
  })) as Record<string, unknown[]> | null
  if (value !== lastSearch.value) {
    console.log(`runSearch: New search was made for ${lastSearch.value} - results are from ${value}`)
    return
  }
  console.log('RESULTS', results)

  isFetching.value = false

  bookResults.value = results?.book || []
  podcastResults.value = results?.podcast || []
  seriesResults.value = results?.series || []
  authorResults.value = results?.authors || []
  narratorResults.value = results?.narrators || []
  tagResults.value = results?.tags || []
}

function updateSearch(val: string) {
  if (searchTimeout.value) clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    runSearch(val)
  }, 500)
}

function setFocus() {
  setTimeout(() => {
    if (inputRef.value) {
      inputRef.value.focus()
    }
  }, 100)
}

onMounted(() => {
  if (globalsStore.lastSearch) {
    search.value = globalsStore.lastSearch
    runSearch(search.value)
  } else {
    nextTick(setFocus)
  }
})
</script>

<style>
.search-content {
  height: calc(100% - 108px);
  max-height: calc(100% - 108px);
}
</style>

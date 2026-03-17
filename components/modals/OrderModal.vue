<template>
  <modals-modal v-model="show" width="90%">
    <div class="w-full h-full bg-md-surface-3 rounded-lg border border-fg/20">
      <ul class="w-full rounded-lg text-base max-h-[70vh] overflow-y-auto overscroll-contain" role="listbox" aria-labelledby="listbox-label">
        <template v-for="item in items" :key="item.value">
          <li class="text-md-on-surface select-none relative py-4 pr-9 cursor-pointer" :class="item.value === selected ? 'bg-md-surface-1/50' : ''" role="option" @click="clickedOption(item.value)">
            <div class="flex items-center">
              <span class="font-normal ml-3 block truncate text-lg">{{ item.text }}</span>
            </div>
            <span v-if="item.value === selected" class="text-yellow-300 absolute inset-y-0 right-0 flex items-center pr-4">
              <span class="material-symbols text-3xl">{{ descending ? 'south' : 'north' }}</span>
            </span>
          </li>
        </template>
      </ul>
    </div>
  </modals-modal>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { useStrings } from '~/composables/useStrings'
import { useHaptics } from '~/composables/useHaptics'
import { useLibrariesStore } from '~/stores/libraries'

const props = defineProps<{
  modelValue: boolean
  orderBy: string | undefined
  descending: boolean | undefined
  episodes?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'update:orderBy': [val: string]
  'update:descending': [val: boolean]
  change: [val: string]
}>()

const strings = useStrings()
const { impact } = useHaptics()
const librariesStore = useLibrariesStore()

const show = computed({
  get() { return props.modelValue },
  set(val: boolean) { emit('update:modelValue', val) }
})

const selected = computed({
  get() { return props.orderBy },
  set(val: string) { emit('update:orderBy', val) }
})

const selectedDesc = computed({
  get() { return props.descending },
  set(val: boolean) { emit('update:descending', val) }
})

const bookItems = computed(() => [
  { text: strings.LabelTitle, value: 'media.metadata.title' },
  { text: strings.LabelAuthorFirstLast, value: 'media.metadata.authorName' },
  { text: strings.LabelAuthorLastFirst, value: 'media.metadata.authorNameLF' },
  { text: strings.LabelPublishYear, value: 'media.metadata.publishedYear' },
  { text: strings.LabelAddedAt, value: 'addedAt' },
  { text: strings.LabelSize, value: 'size' },
  { text: strings.LabelDuration, value: 'media.duration' },
  { text: strings.LabelFileBirthtime, value: 'birthtimeMs' },
  { text: strings.LabelFileModified, value: 'mtimeMs' },
  { text: strings.LabelLibrarySortByProgress, value: 'progress' },
  { text: strings.LabelLibrarySortByProgressStarted, value: 'progress.createdAt' },
  { text: strings.LabelLibrarySortByProgressFinished, value: 'progress.finishedAt' },
  { text: strings.LabelRandomly, value: 'random' }
])

const podcastItems = computed(() => [
  { text: strings.LabelTitle, value: 'media.metadata.title' },
  { text: strings.LabelAuthor, value: 'media.metadata.author' },
  { text: strings.LabelAddedAt, value: 'addedAt' },
  { text: strings.LabelSize, value: 'size' },
  { text: strings.LabelNumberOfEpisodes, value: 'media.numTracks' },
  { text: strings.LabelFileBirthtime, value: 'birthtimeMs' },
  { text: strings.LabelFileModified, value: 'mtimeMs' },
  { text: strings.LabelRandomly, value: 'random' }
])

const episodeItems = computed(() => [
  { text: strings.LabelPubDate, value: 'publishedAt' },
  { text: strings.LabelTitle, value: 'title' },
  { text: strings.LabelSeason, value: 'season' },
  { text: strings.LabelEpisode, value: 'episode' },
  { text: strings.LabelFilename, value: 'audioFile.metadata.filename' }
])

const isPodcast = computed(() => librariesStore.getCurrentLibraryMediaType === 'podcast')

const items = computed(() => {
  if (props.episodes) return episodeItems.value
  if (isPodcast.value) return podcastItems.value
  return bookItems.value
})

async function clickedOption(val: string) {
  await impact()
  if (selected.value === val) {
    selectedDesc.value = !selectedDesc.value
  } else {
    if (val === 'recent' || val === 'addedAt') selectedDesc.value = true
    selected.value = val
  }
  show.value = false
  await nextTick()
  emit('change', val)
}
</script>

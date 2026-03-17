<template>
  <div class="flex h-full px-1 overflow-hidden">
    <covers-book-cover :library-item="libraryItem" :width="coverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />
    <div class="grow px-2 audiobookSearchCardContent">
      <p class="truncate text-sm">{{ title }}</p>
      <p v-if="subtitle" class="truncate text-xs text-gray-300">{{ subtitle }}</p>
      <p class="text-xs text-gray-200 truncate">{{ getString('LabelByAuthor', [authorName]) }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getString } from '~/composables/useStrings'

const props = defineProps<{
  libraryItem?: Record<string, unknown>
  search?: string
}>()

const librariesStore = useLibrariesStore()

const bookCoverAspectRatio = computed(() => librariesStore.getBookCoverAspectRatio as number)
const coverWidth = computed(() => {
  if (bookCoverAspectRatio.value === 1) return 50 * 1.2
  return 50
})
const media = computed(() => props.libraryItem?.media as Record<string, unknown> || {})
const mediaMetadata = computed(() => media.value.metadata as Record<string, unknown> || {})
const mediaType = computed(() => props.libraryItem?.mediaType as string | null ?? null)
const isPodcast = computed(() => mediaType.value === 'podcast')
const title = computed(() => (mediaMetadata.value.title as string) || 'No Title')
const subtitle = computed(() => mediaMetadata.value.subtitle as string | undefined)
const authorName = computed(() => {
  if (isPodcast.value) return mediaMetadata.value.author as string
  return mediaMetadata.value.authorName as string
})
</script>

<style>
.audiobookSearchCardContent {
  width: calc(100% - 80px);
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>

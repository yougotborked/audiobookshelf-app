<template>
  <div class="flex items-center justify-center">
    <img v-if="download.cover" :src="download.cover" class="w-10 h-16 object-contain" />
    <img v-else src="/book_placeholder.jpg" class="w-10 h-16 object-contain" />
    <div class="pl-2 w-2/3">
      <p class="font-normal truncate text-sm">{{ download.audiobook.book.title }}</p>
      <p class="font-normal truncate text-xs text-gray-400">{{ download.audiobook.book.author }}</p>
      <p class="font-normal truncate text-xs text-gray-400">{{ utils.bytesPretty(download.size) }}</p>
    </div>
    <div class="flex-grow" />
    <div v-if="download.isIncomplete || download.isMissing" class="shadow-sm text-warning flex items-center justify-center rounded-full mr-4">
      <span class="material-symbols">error_outline</span>
    </div>
    <button v-if="!isMissing" class="shadow-sm text-accent flex items-center justify-center rounded-full" @click.stop="playDownload">
      <span class="material-symbols fill" style="font-size: 2rem">play_arrow</span>
    </button>
    <div class="shadow-sm text-error flex items-center justify-center rounded-ful ml-4" @click.stop="clickDelete">
      <span class="material-symbols" style="font-size: 1.2rem">delete</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUtils } from '~/composables/useUtils'

const props = defineProps<{
  download: Record<string, unknown>
}>()
const emit = defineEmits<{
  play: [download: Record<string, unknown>]
  delete: [download: Record<string, unknown>]
}>()

const utils = useUtils()

const isMissing = computed(() => props.download.isMissing)

function playDownload() {
  emit('play', props.download)
}

function clickDelete() {
  emit('delete', props.download)
}
</script>

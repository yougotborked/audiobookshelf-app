<template>
  <div :key="bookmark.time" :id="`bookmark-row-${bookmark.time}`" class="flex items-center px-1 py-4 justify-start relative" :class="highlight ? 'bg-md-surface-1/60' : 'opacity-20'" @click="click">
    <div class="flex-grow overflow-hidden px-2">
      <div class="flex items-center mb-0.5">
        <i class="material-symbols text-lg pr-1 -mb-1" :class="{ 'text-md-primary fill': highlight, 'text-md-on-surface-variant': !highlight }">bookmark</i>
        <p class="truncate text-sm">
          {{ bookmark.title }}
        </p>
      </div>
      <p class="text-sm font-mono text-md-on-surface-variant flex items-center"><span class="material-symbols text-base pl-px pr-1">schedule</span>{{ utils.secondsToTimestamp(bookmark.time / playbackRate) }}</p>
    </div>
    <div class="h-full flex items-center justify-end transform w-16 pr-2" @click.stop>
      <span class="material-symbols text-2xl mr-2 text-md-on-surface hover:text-yellow-400" @click.stop="editClick">edit</span>
      <span class="material-symbols text-2xl text-md-on-surface hover:text-error" @click.stop="deleteClick">delete</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUtils } from '~/composables/useUtils'

interface Bookmark {
  time: number
  title?: string
  [key: string]: unknown
}

const props = defineProps<{
  bookmark: Bookmark
  highlight: boolean
  playbackRate: number
}>()
const emit = defineEmits<{
  click: [bookmark: Bookmark]
  delete: [bookmark: Bookmark]
  edit: [bookmark: Bookmark]
}>()

const utils = useUtils()

function click() {
  emit('click', props.bookmark)
}

function deleteClick() {
  emit('delete', props.bookmark)
}

function editClick() {
  emit('edit', props.bookmark)
}
</script>

<template>
  <div class="w-full bg-md-secondary-container rounded-lg">
    <div class="w-full h-14 flex items-center px-3">
      <p class="pr-2">{{ strings.HeaderPlaylistItems }}</p>

      <div class="w-6 h-6 md:w-7 md:h-7 bg-fg bg-opacity-10 rounded-full flex items-center justify-center">
        <span class="text-xs md:text-sm font-mono leading-none">{{ displayCount }}</span>
      </div>

      <div class="flex-grow" />
      <p v-if="totalDuration" class="text-sm text-md-on-surface">{{ totalDurationPretty }}</p>
    </div>
    <template v-for="item in items">
      <tables-playlist-item-table-row
        :key="itemKey(item)"
        :item="item"
        :playlist-id="playlistId"
        @showMore="showMore"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  playlistId?: string
  items: Record<string, unknown>[]
  totalItems?: number | null
}>()

const emit = defineEmits<{
  showMore: [item: Record<string, unknown>]
}>()

const strings = useStrings()
const utils = useUtils()

const displayCount = computed(() => {
  if (props.totalItems && props.totalItems > props.items.length) {
    return `${props.items.length}/${props.totalItems}`
  }
  return `${props.items.length}`
})

const totalDuration = computed(() => {
  let _total = 0
  props.items.forEach((item) => {
    const ep = item.episode as Record<string, unknown> | undefined
    if (ep) _total += (ep.duration as number) || 0
    else _total += ((item.libraryItem as Record<string, unknown>)?.media as Record<string, unknown>)?.duration as number || 0
  })
  return _total
})

const totalDurationPretty = computed(() => utils.elapsedPrettyExtended(totalDuration.value))

function itemKey(item: Record<string, unknown>) {
  if (item?.id) return item.id as string
  const ep = item?.episode as Record<string, unknown> | undefined
  const episodeId = (item?.episodeId as string) || (ep?.serverEpisodeId as string) || (ep?.id as string) || 'book'
  const libraryItemId = (item?.libraryItemId as string) || ((item?.libraryItem as Record<string, unknown>)?.id as string) || 'unknown'
  return `${libraryItemId}_${episodeId}`
}

function showMore(playlistItem: Record<string, unknown>) {
  emit('showMore', playlistItem)
}
</script>

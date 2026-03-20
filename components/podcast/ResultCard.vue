<template>
  <div class="flex items-start gap-3 px-4 py-3 active:bg-md-surface-3 transition-colors">
    <!-- Artwork -->
    <div class="h-14 w-14 shrink-0 rounded-md overflow-hidden bg-md-surface-3">
      <img v-if="podcast.cover" :src="podcast.cover" class="h-full w-full object-cover" loading="lazy" />
      <div v-else class="h-full w-full flex items-center justify-center">
        <span class="material-symbols text-md-on-surface-variant text-3xl">podcasts</span>
      </div>
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-semibold text-md-on-surface truncate leading-snug">{{ podcast.title }}</p>
      <p class="text-xs text-md-on-surface-variant truncate">{{ podcast.artistName }}</p>
      <p v-if="podcast.genres?.length" class="text-xxs text-md-on-surface-variant/70 truncate mt-0.5">
        {{ podcast.genres.slice(0, 3).join(' · ') }}
      </p>
    </div>

    <!-- Action -->
    <div class="shrink-0 flex flex-col items-end gap-1 self-center">
      <span
        v-if="inLibrary"
        class="text-xxs px-2 py-0.5 rounded-md-full bg-md-secondary-container text-md-on-secondary-container font-medium whitespace-nowrap"
      >
        {{ strings.LabelInLibrary }}
      </span>
      <button
        v-else-if="showAdd"
        class="text-xxs px-3 py-1 rounded-md-full bg-md-primary text-md-on-primary font-semibold active:opacity-75 transition-opacity whitespace-nowrap"
        @click.stop="$emit('add')"
      >
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

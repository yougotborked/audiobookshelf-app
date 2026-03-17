<template>
  <div class="w-full relative">
    <div v-if="altViewEnabled" class="px-5 pb-3 pt-4">
      <p class="font-semibold" :style="{ fontSize: sizeMultiplier + 'rem' }">{{ label }}</p>
    </div>

    <div class="flex items-end px-3 max-w-full overflow-x-auto" :class="altViewEnabled ? '' : 'bookshelfRow'" :style="{ height: shelfHeight + 'px', paddingBottom: entityPaddingBottom + 'px' }">
      <template v-for="(entity, index) in entities">
        <cards-lazy-book-card v-if="type === 'book' || type === 'podcast'" :key="(entity as Record<string, unknown>).id as string" :index="index" :book-mount="entity" :width="bookWidth" :height="entityHeight" :book-cover-aspect-ratio="bookCoverAspectRatio" :is-alt-view-enabled="altViewEnabled" class="mx-2 relative" />
        <cards-lazy-book-card v-if="type === 'episode'" :key="((entity as Record<string, unknown>).recentEpisode as Record<string, unknown>).id as string" :index="index" :book-mount="entity" :width="bookWidth" :height="entityHeight" :book-cover-aspect-ratio="bookCoverAspectRatio" :is-alt-view-enabled="altViewEnabled" class="mx-2 relative" />
        <cards-lazy-series-card v-else-if="type === 'series'" :key="(entity as Record<string, unknown>).id as string" :index="index" :series-mount="entity" :width="bookWidth * 2" :height="entityHeight" :book-cover-aspect-ratio="bookCoverAspectRatio" :is-alt-view-enabled="altViewEnabled" is-categorized class="mx-2 relative" />
        <cards-author-card v-else-if="type === 'authors'" :key="(entity as Record<string, unknown>).id as string" :width="bookWidth / 1.25" :height="bookWidth" :author="entity" :size-multiplier="1" class="mx-2" />
      </template>
    </div>

    <div v-if="!altViewEnabled" class="absolute text-center categoryPlacardtransform z-30 bottom-0.5 left-4 md:left-8 w-36 rounded-md" style="height: 18px">
      <div class="w-full h-full flex items-center justify-center rounded-sm border shinyBlack">
        <p class="transform text-xs">{{ label }}</p>
      </div>
    </div>
    <div v-if="!altViewEnabled" class="w-full h-5 z-40 bookshelfDivider"></div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  label?: string
  type?: string
  entities?: Record<string, unknown>[]
}>()

const globalsStore = useGlobalsStore()
const appStore = useAppStore()

const bookCoverAspectRatio = computed(() => globalsStore.getBookCoverAspectRatio)
const altViewEnabled = computed(() => appStore.getAltViewEnabled)
const isCoverSquareAspectRatio = computed(() => bookCoverAspectRatio.value === 1)

const bookWidth = computed(() => {
  const coverSize = 100
  if (isCoverSquareAspectRatio.value) return coverSize * 1.6
  return coverSize
})

const bookHeight = computed(() => {
  if (isCoverSquareAspectRatio.value) return bookWidth.value
  return bookWidth.value * 1.6
})

const entityHeight = computed(() => bookHeight.value)

const sizeMultiplier = computed(() => {
  const baseSize = isCoverSquareAspectRatio.value ? 192 : 120
  return bookWidth.value / baseSize
})

const entityPaddingBottom = computed(() => {
  if (!altViewEnabled.value) return 0
  if (props.type === 'authors') return 10
  else if (props.type === 'series') return 40
  return 60 * sizeMultiplier.value
})

const shelfHeight = computed(() => {
  if (altViewEnabled.value) {
    const extraTitleSpace = props.type === 'authors' ? 10 : props.type === 'series' ? 50 : 60
    return entityHeight.value + extraTitleSpace * sizeMultiplier.value
  }
  return entityHeight.value + 40
})
</script>

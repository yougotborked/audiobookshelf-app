<template>
  <div class="w-full h-full">
    <home-bookshelf-nav-bar />
    <home-bookshelf-toolbar v-show="!hideToolbar" />
    <div id="bookshelf-wrapper" class="main-content overflow-y-auto overflow-x-hidden relative" :class="hideToolbar ? 'no-toolbar' : ''">
      <NuxtPage />
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

const hideToolbar = computed(() => isHome.value || isLatest.value || isPodcastSearch.value)
const isHome = computed(() => route.name === 'bookshelf')
const isLatest = computed(() => route.name === 'bookshelf-latest')
const isPodcastSearch = computed(() => route.name === 'bookshelf-add-podcast')
</script>

<style>
.main-content {
  height: calc(100% - 72px);
  max-height: calc(100% - 72px);
  min-height: calc(100% - 72px);
  max-width: 100vw;
}
.main-content.no-toolbar {
  height: calc(100% - 36px);
  max-height: calc(100% - 36px);
  min-height: calc(100% - 36px);
}
</style>

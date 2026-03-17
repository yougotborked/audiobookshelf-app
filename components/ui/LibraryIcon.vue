<template>
  <div :class="`h-${size} w-${size} min-w-${size} text-${fontSize}`" class="flex items-center justify-center">
    <span class="abs-icons" :class="`icon-${iconToUse}`"></span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGlobalsStore } from '~/stores/globals'

const props = defineProps<{
  icon?: string
  fontSize?: string
  size?: number
}>()

const globalsStore = useGlobalsStore()

const icons = computed(() => globalsStore.libraryIcons)
const iconToUse = computed(() => icons.value.includes(props.icon ?? '') ? props.icon : 'audiobookshelf')
</script>
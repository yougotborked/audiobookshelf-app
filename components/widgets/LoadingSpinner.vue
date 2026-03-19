<template>
  <svg
    :width="sizePx"
    :height="sizePx"
    viewBox="0 0 48 48"
    class="animate-spin text-md-primary"
    aria-label="Loading"
    role="status"
  >
    <circle
      cx="24" cy="24" r="20"
      fill="none"
      stroke="currentColor"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      stroke-dasharray="80 45"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: string
}>(), {
  size: 'la-sm'
})

const sizePx = computed(() => {
  const map: Record<string, number> = { 'la-sm': 24, 'la-lg': 32, 'la-2x': 48, 'la-3x': 64 }
  return map[props.size] ?? 24
})

const strokeWidth = computed(() => sizePx.value < 32 ? 4 : 3)
</script>

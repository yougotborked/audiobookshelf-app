<template>
  <!--
    The Podshelf mark - headphones around a microphone built from shelf rails. See
    design/podshelf-mark.svg for the reasoning and the master copy.

    Inline rather than an <img> so it takes currentColor: the same mark has to sit on a dark
    surface, on paper and inside a filled container, and a PNG would need one file per theme.
  -->
  <svg viewBox="0 0 64 64" fill="none" role="img" :aria-label="label">
    <g stroke="currentColor" stroke-width="5.5" stroke-linecap="round">
      <path d="M10.5 31 A21.5 21.5 0 0 1 53.5 31" />
      <rect x="5" y="31" width="11" height="17" rx="5.5" />
      <rect x="48" y="31" width="11" height="17" rx="5.5" />
      <path d="M28 22 H36" />
      <path d="M25 31 H39" />
      <path d="M28 40 H36" />
      <path d="M32 40 V51" />
      <path d="M22 51 H42" />
    </g>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Podshelf' })
</script>

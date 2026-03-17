<template>
  <div class="flex h-full px-1 overflow-hidden">
    <div class="w-10 h-10 flex items-center justify-center">
      <span class="material-symbols fill text-2xl text-md-on-surface">sell</span>
    </div>
    <div class="flex-grow px-2 tagSearchCardContent h-full">
      <p class="truncate text-sm">{{ tag }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tag?: string
}>()
</script>

<style>
.tagSearchCardContent {
  width: calc(100% - 40px);
  height: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>

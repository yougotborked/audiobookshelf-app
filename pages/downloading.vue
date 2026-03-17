<template>
  <div class="w-full h-full py-6 px-4 overflow-y-auto">
    <p class="mb-4 text-base text-md-on-surface">{{ $strings.HeaderDownloads }} ({{ downloadItemParts.length }})</p>

    <div v-if="!downloadItemParts.length" class="py-6 text-center text-lg">No download item parts</div>
    <template v-for="(itemPart, num) in downloadItemParts">
      <div :key="itemPart.id" class="w-full">
        <div class="flex">
          <div class="w-14">
            <span v-if="itemPart.completed" class="material-symbols text-md-primary">check_circle</span>
            <span v-else class="font-semibold text-md-on-surface">{{ Math.round(itemPart.progress) }}%</span>
          </div>
          <div class="flex-grow px-2">
            <p class="break-all">{{ itemPart.filename }}</p>
          </div>
        </div>

        <div v-if="num + 1 < downloadItemParts.length" class="flex border-t border-md-outline-variant my-3" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useGlobalsStore } from '~/stores/globals'

const globalsStore = useGlobalsStore()

const downloadItems = computed(() => globalsStore.itemDownloads)
const downloadItemParts = computed(() => {
  type Part = { id: string; completed: boolean; progress: number; filename: string; [key: string]: unknown }
  const parts: Part[] = []
  downloadItems.value.forEach((di) => parts.push(...(di.downloadItemParts as unknown as Part[])))
  return parts
})
</script>


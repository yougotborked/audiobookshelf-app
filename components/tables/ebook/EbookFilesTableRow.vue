<template>
  <tr>
    <td class="px-4">{{ (file.metadata as any).filename }} <span v-if="isPrimary" class="material-symbols text-md-primary align-text-bottom text-base">check_circle</span></td>
    <td class="text-xs w-16">
      <ui-icon-btn icon="auto_stories" outlined borderless icon-font-size="1.125rem" :size="8" @click="readEbook" />
    </td>
    <td v-if="contextMenuItems.length" class="text-center">
      <ui-icon-btn icon="more_vert" borderless @click="clickMore" />
    </td>
  </tr>
</template>

<script setup lang="ts">
const props = defineProps<{
  libraryItemId?: string
  showFullPath?: boolean
  file: Record<string, unknown>
}>()

const emit = defineEmits<{
  more: [payload: { file: Record<string, unknown>; items: { text: string; value: string }[] }]
  read: [ino: unknown]
}>()

const strings = useStrings()
const userStore = useUserStore()
const librariesStore = useLibrariesStore()

const userCanUpdate = computed(() => userStore.getUserCanUpdate)
const isPrimary = computed(() => !props.file.isSupplementary)
const libraryIsAudiobooksOnly = computed(() => librariesStore.getLibraryIsAudiobooksOnly)

const contextMenuItems = computed(() => {
  const items: { text: string; value: string }[] = []
  if (userCanUpdate.value && !libraryIsAudiobooksOnly.value) {
    items.push({
      text: isPrimary.value ? strings.LabelSetEbookAsSupplementary : strings.LabelSetEbookAsPrimary,
      value: 'updateStatus'
    })
  }
  return items
})

function clickMore() {
  emit('more', {
    file: props.file,
    items: contextMenuItems.value
  })
}

function readEbook() {
  emit('read', props.file.ino)
}
</script>

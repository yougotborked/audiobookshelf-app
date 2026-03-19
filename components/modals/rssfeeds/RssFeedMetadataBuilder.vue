<template>
  <div class="w-full py-2 text-sm">
    <div class="flex -mb-px">
      <div class="w-1/2 h-6 rounded-tl-md relative border border-fg/10 flex items-center justify-center cursor-pointer" :class="!showAdvancedView ? 'text-md-on-surface bg-md-surface-1 border-b-md-surface-1' : 'text-md-on-surface-variant bg-md-surface-3/70'" @click="showAdvancedView = false">
        <p class="text-sm">{{ strings.HeaderRSSFeedGeneral }}</p>
      </div>
      <div class="w-1/2 h-6 rounded-tr-md relative border border-fg/10 flex items-center justify-center -ml-px cursor-pointer" :class="showAdvancedView ? 'text-md-on-surface bg-md-surface-1 border-b-md-surface-1' : 'text-md-on-surface-variant bg-md-surface-3/70'" @click="showAdvancedView = true">
        <p class="text-sm">{{ strings.HeaderAdvanced }}</p>
      </div>
    </div>
    <div class="px-2 py-4 md:p-4 border border-fg/10 rounded-b-md mr-px" style="min-height: 220px">
      <template v-if="!showAdvancedView">
        <div class="flex-grow pt-2 mb-2">
          <ui-checkbox v-model="preventIndexing" :label="strings.LabelPreventIndexing" checkbox-bg="md-surface-3" border-color="border" label-class="pl-2" />
        </div>
      </template>
      <template v-else>
        <div class="flex-grow pt-2 mb-2">
          <ui-checkbox v-model="preventIndexing" :label="strings.LabelPreventIndexing" checkbox-bg="md-surface-3" border-color="border" label-class="pl-2" />
        </div>
        <div class="w-full relative mb-1">
          <ui-text-input-with-label v-model="ownerName" :label="strings.LabelRSSFeedCustomOwnerName" />
        </div>
        <div class="w-full relative mb-1">
          <ui-text-input-with-label v-model="ownerEmail" :label="strings.LabelRSSFeedCustomOwnerEmail" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStrings } from '~/composables/useStrings'

interface MetadataDetails {
  preventIndexing: boolean
  ownerName: string
  ownerEmail: string
}

const props = defineProps<{
  modelValue: MetadataDetails
}>()
const emit = defineEmits<{
  'update:modelValue': [val: MetadataDetails]
}>()

const strings = useStrings()

const showAdvancedView = ref(false)

const preventIndexing = computed({
  get() { return props.modelValue.preventIndexing },
  set(value: boolean) { emit('update:modelValue', { ...props.modelValue, preventIndexing: value }) }
})

const ownerName = computed({
  get() { return props.modelValue.ownerName },
  set(value: string) { emit('update:modelValue', { ...props.modelValue, ownerName: value }) }
})

const ownerEmail = computed({
  get() { return props.modelValue.ownerEmail },
  set(value: string) { emit('update:modelValue', { ...props.modelValue, ownerEmail: value }) }
})
</script>

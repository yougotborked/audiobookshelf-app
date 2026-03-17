<template>
  <modals-modal v-model="show" @update:modelValue="modalInput" :width="200">
    <div class="px-4 pt-2 pb-2">
      <p class="text-md-title-m text-md-on-surface mb-3">{{ strings.LabelPlaybackSpeed }}</p>
      <div class="w-full overflow-x-hidden overflow-y-auto" style="max-height: 60vh">
        <ul class="w-full" role="listbox" aria-labelledby="listbox-label">
          <template v-for="rate in rates">
            <li :key="rate" class="text-md-on-surface select-none relative py-4 rounded-md-sm" :class="rate === selected ? 'bg-md-secondary-container' : 'hover:bg-md-on-surface/5'" role="option" @click="clickedOption(rate)">
              <div class="flex items-center justify-center">
                <span class="font-normal block truncate text-lg">{{ rate }}x</span>
              </div>
            </li>
          </template>
        </ul>
        <div class="flex items-center justify-center py-3 border-t border-md-outline-variant/30">
          <button :disabled="!canDecrement" @click="decrement" class="icon-num-btn w-8 h-8 text-md-on-surface-variant rounded-md-sm border border-md-outline-variant flex items-center justify-center">
            <span class="material-symbols">remove</span>
          </button>
          <div class="w-24 text-center">
            <p class="text-xl text-md-on-surface">{{ playbackRate }}<span class="text-lg">⨯</span></p>
          </div>
          <button :disabled="!canIncrement" @click="increment" class="icon-num-btn w-8 h-8 text-md-on-surface-variant rounded-md-sm border border-md-outline-variant flex items-center justify-center">
            <span class="material-symbols">add</span>
          </button>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useStrings } from '~/composables/useStrings'

const props = defineProps<{
  modelValue: boolean
  playbackRate: number
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'update:playbackRate': [val: number]
  change: [val: number]
}>()

const strings = useStrings()

const MIN_SPEED = 0.5
const MAX_SPEED = 10
const currentPlaybackRate = ref(0)

const show = computed({
  get() { return props.modelValue },
  set(val: boolean) { emit('update:modelValue', val) }
})

const selected = computed({
  get() { return props.playbackRate },
  set(val: number) { emit('update:playbackRate', val) }
})

const rates = computed(() => [0.5, 1, 1.2, 1.5, 1.7, 2, 3])

const canIncrement = computed(() => props.playbackRate + 0.1 <= MAX_SPEED)
const canDecrement = computed(() => props.playbackRate - 0.1 >= MIN_SPEED)

watch(show, (newVal) => {
  if (newVal) {
    currentPlaybackRate.value = selected.value
  }
})

function increment() {
  if (selected.value + 0.1 > MAX_SPEED) return
  const newPlaybackRate = selected.value + 0.1
  selected.value = Number(newPlaybackRate.toFixed(1))
}

function decrement() {
  if (selected.value - 0.1 < MIN_SPEED) return
  const newPlaybackRate = selected.value - 0.1
  selected.value = Number(newPlaybackRate.toFixed(1))
}

function modalInput(val: boolean) {
  if (!val) {
    if (currentPlaybackRate.value !== selected.value) {
      emit('change', selected.value)
    }
  }
}

function clickedOption(rate: number) {
  selected.value = Number(rate)
  show.value = false
  emit('change', Number(rate))
}
</script>

<style>
button.icon-num-btn:disabled {
  cursor: not-allowed;
}
button.icon-num-btn:disabled::before {
  background-color: rgba(0, 0, 0, 0.2);
}
button.icon-num-btn:disabled span {
  color: #777;
}
</style>

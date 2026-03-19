<template>
  <div class="inline-flex">
    <input v-model="input" type="range" :min="min" :max="max" :step="step" :style="{ width: inputWidth }" />

    <p class="text-xs ml-2">{{ input }}%</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue?: string | number
  min?: number
  max?: number
  step?: number
  inputWidth?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [val: string | number]
}>()

const input = computed({
  get() { return props.modelValue },
  set(val: string | number | undefined) { if (val !== undefined) emit('update:modelValue', val) }
})
</script>

<style scoped>
input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
}
input[type='range']:focus {
  outline: none;
}

/* chromium */
input[type='range']::-webkit-slider-runnable-track {
  background-color: rgb(var(--color-track) / 0.5);
  border-radius: 9999px;
  height: 0.75rem;
}
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  margin-top: -0.25rem;
  border-radius: 9999px;
  background-color: rgb(var(--color-track-cursor));
  height: 1.25rem;
  width: 1.25rem;
}
input[type='range']:focus::-webkit-slider-thumb {
  border: 1px solid rgb(var(--color-track));
  outline: 3px solid rgb(var(--color-track));
  outline-offset: 0.125rem;
}

/* firefox */
input[type='range']::-moz-range-track {
  background-color: rgb(var(--color-track) / 0.5);
  border-radius: 9999px;
  height: 0.75rem;
}
input[type='range']::-moz-range-thumb {
  border: none;
  border-radius: 9999px;
  margin-top: -0.25rem;
  background-color: rgb(var(--color-track-cursor));
  height: 1.25rem;
  width: 1.25rem;
}
input[type='range']:focus::-moz-range-thumb {
  border: 1px solid rgb(var(--color-track));
  outline: 3px solid rgb(var(--color-track));
  outline-offset: 0.125rem;
}
</style>
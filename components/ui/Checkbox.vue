<template>
  <label class="flex justify-start items-center" :class="!disabled ? 'cursor-pointer' : ''">
    <div class="border-2 rounded flex flex-shrink-0 justify-center items-center" :class="wrapperClass">
      <input v-model="selected" :disabled="disabled" type="checkbox" class="opacity-0 absolute" :class="!disabled ? 'cursor-pointer' : ''" />
      <svg v-if="selected" class="fill-current pointer-events-none" :class="svgClass" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>
    </div>
    <div v-if="label" class="select-none text-md-on-surface" :class="labelClassname">{{ label }}</div>
  </label>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  label?: string
  small?: boolean
  checkboxBg?: string
  borderColor?: string
  checkColor?: string
  labelClass?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
}>()

const checkboxBg = computed(() => props.checkboxBg ?? 'white')
const borderColor = computed(() => props.borderColor ?? 'gray-400')
const checkColor = computed(() => props.checkColor ?? 'green-500')

const selected = computed({
  get() { return props.modelValue },
  set(val: boolean) { emit('update:modelValue', !!val) }
})

const wrapperClass = computed(() => {
  const classes = [`bg-${checkboxBg.value} border-${borderColor.value}`]
  if (props.small) classes.push('w-4 h-4')
  else classes.push('w-6 h-6')
  return classes.join(' ')
})

const labelClassname = computed(() => {
  if (props.labelClass) return props.labelClass
  const classes = ['pl-1']
  if (props.small) classes.push('text-xs md:text-sm')
  return classes.join(' ')
})

const svgClass = computed(() => {
  const classes = [`text-${checkColor.value}`]
  if (props.small) classes.push('w-3 h-3')
  else classes.push('w-4 h-4')
  return classes.join(' ')
})
</script>

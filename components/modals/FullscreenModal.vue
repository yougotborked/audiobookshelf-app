<template>
  <div ref="wrapper" class="modal modal-bg w-screen fixed bottom-0 left-0 flex items-center justify-center z-50" :class="threeQuartersScreen ? 'h-[75vh] min-h-[400px] short:min-h-0 short:h-screen' : 'h-screen'" @click.stop @touchstart.stop @touchend.stop>
    <div ref="content" class="relative text-md-on-surface h-full w-full bg-md-surface-1">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useGlobalsStore } from '~/stores/globals'
import { useEventBus } from '~/composables/useEventBus'

const props = defineProps<{
  modelValue: boolean
  processing?: boolean
  threeQuartersScreen?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
}>()

const globalsStore = useGlobalsStore()
const eventBus = useEventBus()

const wrapper = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const el = ref<HTMLElement | null>(null)

const show = computed({
  get() { return props.modelValue },
  set(val: boolean) { emit('update:modelValue', val) }
})

watch(show, (newVal) => {
  if (newVal) {
    setShow()
  } else {
    setHide()
  }
})

function setShow() {
  globalsStore.isModalOpen = true

  document.body.appendChild(el.value!)
  setTimeout(() => {
    content.value!.style.transform = 'translateY(0)'
  }, 10)
  document.documentElement.classList.add('modal-open')
}

function setHide() {
  globalsStore.isModalOpen = false

  content.value!.style.transform = 'translateY(100vh)'
  setTimeout(() => {
    el.value!.remove()
    document.documentElement.classList.remove('modal-open')
  }, 250)
}

function closeModalEvt() {
  console.log('Close modal event')
  show.value = false
}

onMounted(() => {
  eventBus.on('close-modal', closeModalEvt)
  el.value = wrapper.value
  content.value!.style.transform = 'translateY(100vh)'
  content.value!.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
  el.value!.remove()
})

onBeforeUnmount(() => {
  eventBus.off('close-modal', closeModalEvt)
})
</script>

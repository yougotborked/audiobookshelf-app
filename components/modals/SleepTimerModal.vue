<template>
  <modals-modal v-model="show" :width="200">
    <div class="px-4 pt-2 pb-2">
      <p class="text-md-title-m text-md-on-surface mb-3">{{ strings.HeaderSleepTimer }}</p>
      <div class="w-full overflow-x-hidden overflow-y-auto" style="max-height: 60vh">
        <div v-if="manualTimerModal" class="py-2">
          <div class="flex mb-4 cursor-pointer" @click="manualTimerModal = false">
            <span class="material-symbols text-3xl text-md-on-surface">arrow_back</span>
          </div>
          <div class="flex my-2 justify-between">
            <ui-btn @click="decreaseManualTimeout" class="w-9 h-9" :padding-x="0" small style="max-width: 36px"><span class="material-symbols text-lg">remove</span></ui-btn>
            <p class="text-2xl font-mono text-center text-md-on-surface">{{ manualTimeoutMin }} min</p>
            <ui-btn @click="increaseManualTimeout" class="w-9 h-9" :padding-x="0" small style="max-width: 36px"><span class="material-symbols text-lg">add</span></ui-btn>
          </div>
          <ui-btn @click="clickedOption(manualTimeoutMin)" class="w-full">{{ strings.ButtonSetTimer }}</ui-btn>
        </div>
        <ul v-else-if="!sleepTimerRunning" class="w-full" role="listbox" aria-labelledby="listbox-label">
          <template v-for="timeout in timeouts" :key="timeout">
            <li class="text-md-on-surface select-none relative py-4 rounded-md-sm hover:bg-md-on-surface/5" role="option" @click="clickedOption(timeout)">
              <div class="flex items-center justify-center">
                <span class="font-normal block truncate text-lg">{{ timeout }} min</span>
              </div>
            </li>
          </template>
          <li v-if="currentEndOfChapterTime" class="text-md-on-surface select-none relative py-4 rounded-md-sm hover:bg-md-on-surface/5" role="option" @click="clickedChapterOption()">
            <div class="flex items-center justify-center">
              <span class="font-normal block truncate text-lg text-center">{{ strings.LabelEndOfChapter }}</span>
            </div>
          </li>
          <li class="text-md-on-surface select-none relative py-4 rounded-md-sm hover:bg-md-on-surface/5" role="option" @click="manualTimerModal = true">
            <div class="flex items-center justify-center">
              <span class="font-normal block truncate text-lg text-center">{{ strings.LabelCustomTime }}</span>
            </div>
          </li>
        </ul>
        <div v-else class="py-2">
          <div class="flex my-2 justify-between">
            <ui-btn @click="decreaseSleepTime" class="w-9 h-9" :padding-x="0" small style="max-width: 36px"><span class="material-symbols text-lg">remove</span></ui-btn>
            <p class="text-2xl font-mono text-center text-md-on-surface">{{ timeRemainingPretty }}</p>
            <ui-btn @click="increaseSleepTime" class="w-9 h-9" :padding-x="0" small style="max-width: 36px"><span class="material-symbols text-lg">add</span></ui-btn>
          </div>
          <ui-btn @click="cancelSleepTimer" class="w-full">{{ isAuto ? strings.ButtonDisableAutoTimer : strings.ButtonCancelTimer }}</ui-btn>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { Dialog } from '@capacitor/dialog'
import { useStrings } from '~/composables/useStrings'
import { useHaptics } from '~/composables/useHaptics'
import { useUtils } from '~/composables/useUtils'

const props = defineProps<{
  modelValue: boolean
  currentTime: number
  sleepTimerRunning: boolean
  currentEndOfChapterTime: number
  isAuto: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  change: [payload: { time: number; isChapterTime: boolean }]
  cancel: []
  increase: []
  decrease: []
}>()

const strings = useStrings()
const { impact } = useHaptics()
const utils = useUtils()

const manualTimerModal = ref(false)
const manualTimeoutMin = ref(1)

const show = computed({
  get() { return props.modelValue },
  set(val: boolean) {
    if (!val) {
      manualTimerModal.value = false
    }
    emit('update:modelValue', val)
  }
})

const timeouts = computed(() => [5, 10, 15, 30, 45, 60, 90])

const timeRemainingPretty = computed(() => {
  if (props.currentTime <= 0) return '0:00'
  return utils.secondsToTimestamp(props.currentTime)
})

async function clickedChapterOption() {
  await impact()
  show.value = false
  await nextTick()
  emit('change', { time: props.currentEndOfChapterTime * 1000, isChapterTime: true })
}

async function clickedOption(timeoutMin: number) {
  await impact()
  const timeout = timeoutMin * 1000 * 60
  show.value = false
  manualTimerModal.value = false
  await nextTick()
  emit('change', { time: timeout, isChapterTime: false })
}

async function cancelSleepTimer() {
  if (props.isAuto) {
    const { value } = await Dialog.confirm({
      title: strings.HeaderConfirm,
      message: strings.MessageConfirmDisableAutoTimer
    })
    if (!value) return
  }

  await impact()
  emit('cancel')
  show.value = false
}

async function increaseSleepTime() {
  await impact()
  emit('increase')
}

async function decreaseSleepTime() {
  await impact()
  emit('decrease')
}

async function increaseManualTimeout() {
  await impact()
  manualTimeoutMin.value++
}

async function decreaseManualTimeout() {
  await impact()
  if (manualTimeoutMin.value > 1) manualTimeoutMin.value--
}
</script>

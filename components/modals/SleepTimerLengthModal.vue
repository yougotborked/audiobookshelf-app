<template>
  <modals-modal v-model="show" :width="200">
    <div class="px-4 pt-2 pb-2">
      <p class="text-md-title-m text-md-on-surface mb-3">{{ $strings.HeaderSleepTimer }}</p>
      <div class="w-full overflow-x-hidden overflow-y-auto" style="max-height: 60vh">
        <div v-if="manualTimerModal" class="py-2">
          <div class="flex mb-4 cursor-pointer" @click="manualTimerModal = false">
            <span class="material-symbols text-3xl text-md-on-surface">arrow_back</span>
          </div>
          <div class="flex my-2 justify-between">
            <ui-btn @click="decreaseManualTimeout" class="w-9 h-9" :padding-x="0" small style="max-width: 36px"><span class="material-symbols">remove</span></ui-btn>
            <p class="text-2xl font-mono text-center text-md-on-surface">{{ manualTimeoutMin }} min</p>
            <ui-btn @click="increaseManualTimeout" class="w-9 h-9" :padding-x="0" small style="max-width: 36px"><span class="material-symbols">add</span></ui-btn>
          </div>
          <ui-btn @click="clickedOption(manualTimeoutMin)" class="w-full">{{ $strings.ButtonSetTimer }}</ui-btn>
        </div>
        <ul v-else class="w-full" role="listbox" aria-labelledby="listbox-label">
          <template v-for="timeout in timeouts">
            <li :key="timeout" class="text-md-on-surface select-none relative py-4 rounded-md-sm hover:bg-md-on-surface/5" role="option" @click="clickedOption(timeout)">
              <div class="flex items-center justify-center">
                <span class="font-normal block truncate text-lg">{{ timeout }} min</span>
              </div>
            </li>
          </template>
          <li class="text-md-on-surface select-none relative py-4 rounded-md-sm hover:bg-md-on-surface/5" role="option" @click="clickedChapterOption">
            <div class="flex items-center justify-center">
              <span class="font-normal block truncate text-lg text-center">{{ $strings.LabelEndOfChapter }}</span>
            </div>
          </li>
          <li class="text-md-on-surface select-none relative py-4 rounded-md-sm hover:bg-md-on-surface/5" role="option" @click="manualTimerModal = true">
            <div class="flex items-center justify-center">
              <span class="font-normal block truncate text-lg text-center">{{ $strings.LabelCustomTime }}</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean
  },
  data() {
    return {
      manualTimerModal: null,
      manualTimeoutMin: 1
    }
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    timeouts() {
      return [5, 10, 15, 30, 45, 60, 90]
    }
  },
  methods: {
    async clickedChapterOption() {
      await this.$hapticsImpact()
      this.show = false
      this.$nextTick(() => this.$emit('change', 0))
    },
    async clickedOption(timeoutMin) {
      await this.$hapticsImpact()
      const timeout = timeoutMin * 1000 * 60
      this.show = false
      this.manualTimerModal = false
      this.$nextTick(() => this.$emit('change', timeout))
    },
    async increaseManualTimeout() {
      await this.$hapticsImpact()
      this.manualTimeoutMin++
    },
    async decreaseManualTimeout() {
      await this.$hapticsImpact()
      if (this.manualTimeoutMin > 1) this.manualTimeoutMin--
    }
  },
  mounted() {}
}
</script>

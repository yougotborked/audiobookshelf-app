<template>
  <modals-modal v-model="show" @input="modalInput" :width="200">
    <div class="px-4 pt-2 pb-2">
      <p class="text-md-title-m text-md-on-surface mb-3">{{ $strings.LabelPlaybackSpeed }}</p>
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

<script>
export default {
  props: {
    value: Boolean,
    playbackRate: Number
  },
  data() {
    return {
      currentPlaybackRate: 0,
      MIN_SPEED: 0.5,
      MAX_SPEED: 10
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.currentPlaybackRate = this.selected
      }
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
    selected: {
      get() {
        return this.playbackRate
      },
      set(val) {
        this.$emit('update:playbackRate', val)
      }
    },
    rates() {
      return [0.5, 1, 1.2, 1.5, 1.7, 2, 3]
    },
    canIncrement() {
      return this.playbackRate + 0.1 <= this.MAX_SPEED
    },
    canDecrement() {
      return this.playbackRate - 0.1 >= this.MIN_SPEED
    }
  },
  methods: {
    increment() {
      if (this.selected + 0.1 > this.MAX_SPEED) return
      var newPlaybackRate = this.selected + 0.1
      this.selected = Number(newPlaybackRate.toFixed(1))
    },
    decrement() {
      if (this.selected - 0.1 < this.MIN_SPEED) return
      var newPlaybackRate = this.selected - 0.1
      this.selected = Number(newPlaybackRate.toFixed(1))
    },
    modalInput(val) {
      if (!val) {
        if (this.currentPlaybackRate !== this.selected) {
          this.$emit('change', this.selected)
        }
      }
    },
    clickedOption(rate) {
      this.selected = Number(rate)
      this.show = false
      this.$emit('change', Number(rate))
    }
  },
  mounted() {}
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

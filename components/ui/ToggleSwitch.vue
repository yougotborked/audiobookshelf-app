<template>
  <button
    role="switch"
    :aria-checked="String(toggleValue)"
    :disabled="disabled"
    :class="[
      'relative inline-flex shrink-0 cursor-pointer rounded-md-full transition-md-standard',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary',
      disabled ? 'opacity-40 cursor-not-allowed' : '',
      'w-[52px] h-8'
    ]"
    @click.stop="clickToggle"
  >
    <!-- Track -->
    <span :class="[
      'absolute inset-0 rounded-md-full border-2 transition-md-standard',
      toggleValue
        ? 'bg-md-primary border-md-primary'
        : 'bg-transparent border-md-outline'
    ]" />
    <!-- Thumb -->
    <span :class="[
      'absolute top-1/2 -translate-y-1/2 rounded-full transition-md-standard elevation-1',
      toggleValue
        ? 'bg-md-on-primary w-6 h-6 left-[26px]'
        : 'bg-md-outline w-4 h-4 left-[6px]'
    ]" />
  </button>
</template>

<script>
export default {
  model: { prop: 'value', event: 'input' },
  props: {
    value: Boolean,
    disabled: Boolean,
    // kept for backward compat — ignored (M3 uses primary for on state)
    onColor:  { type: String, default: 'success' },
    offColor: { type: String, default: 'primary' }
  },
  computed: {
    toggleValue: {
      get() { return this.value },
      set(v) { this.$emit('input', v) }
    }
  },
  methods: {
    clickToggle() { if (!this.disabled) this.toggleValue = !this.toggleValue }
  }
}
</script>

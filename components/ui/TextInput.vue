<template>
  <div
    :class="[
      'flex items-center relative rounded-md-sm overflow-hidden',
      'bg-md-surface-1 border transition-md-standard',
      focused ? 'border-md-primary border-2' : 'border-md-outline-variant'
    ]"
  >
    <input
      v-model="input"
      ref="input"
      :autofocus="autofocus"
      :type="type"
      :disabled="disabled"
      :readonly="readonly"
      autocorrect="off"
      autocapitalize="none"
      autocomplete="off"
      :placeholder="placeholder"
      :class="inputClass"
      @keyup="keyup"
      @focus="onFocus"
      @blur="focused = false"
    />
    <div v-if="prependIcon" class="absolute top-0 left-0 h-full px-2.5 flex items-center justify-center text-md-on-surface-variant pointer-events-none">
      <span class="material-symbols text-lg">{{ prependIcon }}</span>
    </div>
    <div v-if="clearable && input" class="absolute top-0 right-0 h-full px-2.5 flex items-center justify-center text-md-on-surface-variant" @click.stop="clear">
      <span class="material-symbols text-lg">close</span>
    </div>
    <div v-else-if="!clearable && appendIcon" class="absolute top-0 right-0 h-full px-2.5 flex items-center justify-center text-md-on-surface-variant pointer-events-none">
      <span class="material-symbols text-lg">{{ appendIcon }}</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: [String, Number],
    placeholder: String,
    type: String,
    disabled: Boolean,
    readonly: Boolean,
    borderless: Boolean,
    autofocus: { type: Boolean, default: true },
    bg: { type: String, default: 'bg' },        // kept for backward compat
    rounded: { type: String, default: 'sm' },   // kept for backward compat
    prependIcon: { type: String, default: null },
    appendIcon: { type: String, default: null },
    clearable: Boolean
  },
  data() {
    return { focused: false }
  },
  computed: {
    input: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    inputClass() {
      return [
        'w-full bg-transparent text-md-on-surface text-md-body-l',
        'placeholder:text-md-on-surface-variant',
        'focus:outline-none disabled:opacity-40',
        this.prependIcon ? 'pl-10' : 'pl-4',
        this.appendIcon || this.clearable ? 'pr-10' : 'pr-4',
        'py-3'
      ].join(' ')
    }
  },
  methods: {
    onFocus() { if (!this.readonly) this.focused = true },
    clear() { this.input = '' },
    focus() {
      if (this.$refs.input) {
        this.$refs.input.focus()
        this.$refs.input.click()
      }
    },
    keyup() {
      if (this.$refs.input) this.input = this.$refs.input.value
    }
  }
}
</script>

<style scoped>
input[type='time']::-webkit-calendar-picker-indicator {
  filter: invert(100%);
}
html[data-theme='light'] input[type='time']::-webkit-calendar-picker-indicator {
  filter: unset;
}
</style>

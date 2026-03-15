<template>
  <div class="w-full">
    <label class="block text-md-label-l text-md-on-surface-variant mb-1.5">{{ label }}</label>
    <ui-text-input v-model="inputValue" ref="input" :disabled="disabled" :type="type" :placeholder="placeholder" :autofocus="autofocus" class="w-full" />
  </div>
</template>

<script>
export default {
  props: {
    value: [String, Number],
    label: String,
    type: { type: String, default: 'text' },
    disabled: Boolean,
    placeholder: String,
    autofocus: { type: Boolean, default: true }
  },
  computed: {
    inputValue: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    }
  }
}
</script>

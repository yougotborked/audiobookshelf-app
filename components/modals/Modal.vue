<template>
  <div ref="wrapper" class="modal modal-bg w-full h-full max-h-screen fixed top-0 left-0 flex items-end justify-center z-50 opacity-0" style="background: rgba(0,0,0,0.5)">
    <div class="absolute top-0 left-0 w-full h-full pointer-events-none" />

    <div class="absolute z-40 top-3 right-4 h-10 w-10 flex items-center justify-center cursor-pointer text-md-on-surface-variant hover:text-md-on-surface" @click="show = false">
      <span class="material-symbols text-2xl">close</span>
    </div>
    <slot name="outer" />
    <div ref="content" class="relative text-fg bg-md-surface-3 rounded-t-md-xl w-full overflow-hidden" :style="{ height: modalHeight, maxWidth: maxWidth, maxHeight: '90vh' }" v-click-outside="clickBg">
      <!-- Drag handle -->
      <div class="w-8 h-1 rounded-md-full bg-md-on-surface-variant/40 mx-auto mt-3 mb-1" />
      <slot />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: Boolean,
    processing: Boolean,
    persistent: { type: Boolean, default: true },
    width: { type: [String, Number], default: 500 },
    height: { type: [String, Number], default: 'unset' },
    maxWidth: { type: String, default: '100%' }
  },
  data() {
    return { el: null, content: null }
  },
  watch: {
    show(newVal) {
      if (newVal) this.setShow()
      else this.setHide()
    }
  },
  computed: {
    show: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    modalHeight() {
      if (typeof this.height === 'string') return this.height
      return this.height + 'px'
    }
  },
  methods: {
    clickBg(ev) {
      if (this.processing && this.persistent) return
      if (ev && ev.srcElement && ev.srcElement.classList && ev.srcElement.classList.contains('modal-bg')) {
        this.show = false
      }
    },
    setShow() {
      this.$store.commit('globals/setIsModalOpen', true)
      document.body.appendChild(this.el)
      setTimeout(() => {
        this.content.style.transform = 'translateY(0)'
        this.content.style.opacity = '1'
      }, 10)
      document.documentElement.classList.add('modal-open')
    },
    setHide() {
      this.$store.commit('globals/setIsModalOpen', false)
      this.content.style.transform = 'translateY(100%)'
      this.content.style.opacity = '0'
      setTimeout(() => { this.el.remove() }, 250)
      document.documentElement.classList.remove('modal-open')
    },
    closeModalEvt() { this.show = false }
  },
  mounted() {
    this.$eventBus.$on('close-modal', this.closeModalEvt)
    this.el = this.$refs.wrapper
    this.content = this.$refs.content
    this.content.style.transform = 'translateY(100%)'
    this.content.style.opacity = '0'
    this.content.style.transition = 'transform 250ms cubic-bezier(0, 0, 0, 1), opacity 200ms ease'
    this.el.style.opacity = 1
    this.el.remove()
  },
  beforeDestroy() {
    this.$eventBus.$off('close-modal', this.closeModalEvt)
  }
}
</script>

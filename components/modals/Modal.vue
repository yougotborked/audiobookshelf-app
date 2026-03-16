<template>
  <div ref="wrapper" class="modal modal-bg w-full h-full max-h-screen fixed top-0 left-0 flex items-end justify-center z-50 opacity-0" style="background: rgba(0,0,0,0.5)">
    <div class="absolute top-0 left-0 w-full h-full pointer-events-none" />

    <div class="absolute z-40 top-3 right-4 h-10 w-10 flex items-center justify-center cursor-pointer text-md-on-surface-variant hover:text-md-on-surface" @click="show = false">
      <span class="material-symbols text-2xl">close</span>
    </div>
    <slot name="outer" />
    <div ref="content" class="relative text-md-on-surface bg-md-surface-3 rounded-t-md-xl w-full overflow-hidden" :style="Object.assign({ height: modalHeight, maxWidth: maxWidth, maxHeight: '90vh' }, popoverStyle)" v-click-outside="clickBg">
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
    maxWidth: { type: String, default: '100%' },
    anchorSelector: { type: String, default: null }
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
    },
    popoverStyle() {
      if (!this.anchorSelector) return {}
      if (typeof window === 'undefined') return {}
      const isLandscape = window.innerWidth > window.innerHeight
      if (!isLandscape) return {}
      const anchor = document.querySelector(this.anchorSelector)
      if (!anchor) return {}
      const rect = anchor.getBoundingClientRect()
      const margin = 8
      const estWidth = Math.min(280, window.innerWidth - 32)
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - estWidth - margin))
      const top = Math.min(rect.bottom + margin, window.innerHeight - 100)
      return {
        position: 'fixed',
        left: left + 'px',
        top: top + 'px',
        bottom: 'auto',
        borderRadius: '12px',
        width: estWidth + 'px',
        transform: 'none',
        maxHeight: '60vh'
      }
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
      const isPopover = !!this.anchorSelector && typeof window !== 'undefined' && window.innerWidth > window.innerHeight
      if (isPopover) {
        this.content.style.transform = 'scale(0.95)'
        this.content.style.opacity = '0'
      } else {
        this.content.style.transform = 'translateY(100%)'
        this.content.style.opacity = '0'
      }
      setTimeout(() => {
        this.content.style.transform = isPopover ? 'scale(1)' : 'translateY(0)'
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

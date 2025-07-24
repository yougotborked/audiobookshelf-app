<template>
  <modals-modal v-model="show" :width="400" height="100%">
    <div class="w-full h-full overflow-hidden absolute top-0 left-0 flex items-center justify-center" @click="show = false">
      <div class="w-full rounded-lg bg-secondary border border-fg/20 overflow-y-auto overflow-x-hidden relative" style="max-height: 75%" @click.stop>
        <div class="sticky top-0 bg-primary px-4 py-2 border-b border-fg/10">
          <p class="text-lg text-white">{{ $strings.LabelQueue }}</p>
        </div>
        <template v-for="(item, idx) in queue">
          <div :key="idx" class="flex items-center px-4 py-2 border-b border-fg/10 cursor-pointer" :class="{ 'bg-primary bg-opacity-50': idx === currentIndex }" @click="select(idx)">
            <p class="flex-grow truncate">{{ itemTitle(item) }}</p>
            <span v-if="idx === currentIndex" class="material-symbols text-success">play_arrow</span>
          </div>
        </template>
        <div v-if="!queue.length" class="flex items-center justify-center p-4">
          <p class="text-base text-fg-muted">{{ $strings.MessageNoItems }}</p>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    queue: {
      type: Array,
      default: () => []
    },
    currentIndex: {
      type: Number,
      default: 0
    }
  },
  computed: {
    show: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    }
  },
  methods: {
    itemTitle(item) {
      return item.libraryItem?.title || item.localLibraryItem?.media?.title || ''
    },
    select(idx) {
      this.$emit('select', idx)
    }
  }
}
</script>

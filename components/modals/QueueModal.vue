<template>
  <modals-modal v-model="show" :width="400">
    <p class="text-md-title-m text-md-on-surface px-4 pt-2 pb-1">{{ $strings.LabelQueue }}</p>
    <div class="max-h-[70vh] overflow-y-auto">
      <draggable v-model="localQueue" handle=".drag" tag="div" @end="dragEnd">
        <transition-group type="transition" name="list">
          <div v-for="(item, idx) in localQueue" :key="idx" class="flex items-center px-4 py-2 border-b border-fg/10 cursor-pointer" :class="{ 'bg-md-secondary-container': idx === currentIndex }" @click="select(idx)">
            <span class="material-symbols drag mr-2 text-fg-muted cursor-move">drag_handle</span>
            <p class="flex-grow truncate">{{ itemTitle(item) }}</p>
            <span v-if="idx === currentIndex" class="material-symbols text-md-primary">play_arrow</span>
            <span class="material-symbols text-error ml-2" @click.stop="remove(idx)">close</span>
          </div>
        </transition-group>
      </draggable>
      <div v-if="!queue.length" class="flex items-center justify-center p-4">
        <p class="text-base text-fg-muted">{{ $strings.MessageNoItems }}</p>
      </div>
    </div>
  </modals-modal>
</template>

<script>
import draggable from 'vuedraggable'
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
  components: { draggable },
  data() {
    return {
      localQueue: [...this.queue]
    }
  },
  watch: {
    queue(newVal) {
      this.localQueue = [...newVal]
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
      if (item.episode) return item.episode.title
      if (item.localEpisode) return item.localEpisode.title
      if (item.libraryItem?.media?.metadata?.title) return item.libraryItem.media.metadata.title
      if (item.localLibraryItem?.media?.metadata?.title) return item.localLibraryItem.media.metadata.title
      return ''
    },
    select(idx) {
      this.$emit('select', idx)
    }
    ,
    remove(idx) {
      this.$store.commit('removeQueueItem', idx)
    },
    dragEnd(evt) {
      if (evt.oldIndex === evt.newIndex) return
      this.$store.commit('reorderQueue', { oldIndex: evt.oldIndex, newIndex: evt.newIndex })
    }
  }
}
</script>

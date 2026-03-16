<template>
  <div :key="bookmark.time" :id="`bookmark-row-${bookmark.time}`" class="flex items-center px-1 py-4 justify-start relative" :class="highlight ? 'bg-md-surface-1 bg-opacity-60' : ' bg-opacity-20'" @click="click">
    <div class="flex-grow overflow-hidden px-2">
      <div class="flex items-center mb-0.5">
        <i class="material-symbols text-lg pr-1 -mb-1" :class="{ 'text-md-primary fill': highlight, 'text-md-on-surface-variant': !highlight }">bookmark</i>
        <p class="truncate text-sm">
          {{ bookmark.title }}
        </p>
      </div>
      <p class="text-sm font-mono text-md-on-surface-variant flex items-center"><span class="material-symbols text-base pl-px pr-1">schedule</span>{{ $secondsToTimestamp(bookmark.time / playbackRate) }}</p>
    </div>
    <div class="h-full flex items-center justify-end transform w-16 pr-2" @click.stop>
      <span class="material-symbols text-2xl mr-2 text-md-on-surface hover:text-yellow-400" @click.stop="editClick">edit</span>
      <span class="material-symbols text-2xl text-md-on-surface hover:text-error" @click.stop="deleteClick">delete</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    bookmark: {
      type: Object,
      default: () => {}
    },
    highlight: Boolean,
    playbackRate: Number
  },
  data() {
    return {}
  },
  computed: {},
  methods: {
    click() {
      this.$emit('click', this.bookmark)
    },
    deleteClick() {
      this.$emit('delete', this.bookmark)
    },
    editClick() {
      this.$emit('edit', this.bookmark)
    }
  }
}
</script>

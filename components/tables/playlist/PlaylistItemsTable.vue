<template>
  <div class="w-full bg-primary/50 rounded-lg">
    <div class="w-full h-14 flex items-center px-3">
      <p class="pr-2">{{ $strings.HeaderPlaylistItems }}</p>

      <div class="w-6 h-6 md:w-7 md:h-7 bg-fg bg-opacity-10 rounded-full flex items-center justify-center">
        <span class="text-xs md:text-sm font-mono leading-none">{{ items.length }}</span>
      </div>

      <div class="flex-grow" />
      <p v-if="totalDuration" class="text-sm text-fg">{{ totalDurationPretty }}</p>
    </div>
    <template v-for="item in visibleItems">
      <tables-playlist-item-table-row :key="item.id" :item="item" :playlist-id="playlistId" @showMore="showMore" />
    </template>
    <div v-if="hasMore" ref="sentinel" class="h-4"></div>
  </div>
</template>

<script>
const INITIAL_RENDER_COUNT = 60
const CHUNK_SIZE = 40

export default {
  props: {
    playlistId: String,
    items: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      visibleCount: INITIAL_RENDER_COUNT,
      observer: null
    }
  },
  computed: {
    visibleItems() {
      if (!Array.isArray(this.items)) return []
      return this.items.slice(0, Math.min(this.visibleCount, this.items.length))
    },
    hasMore() {
      return Array.isArray(this.items) && this.visibleCount < this.items.length
    },
    totalDuration() {
      if (!Array.isArray(this.items) || !this.items.length) return 0

      var _total = 0
      this.items.forEach((item) => {
        if (item.episode) _total += item.episode.duration
        else _total += item.libraryItem.media.duration
      })
      return _total
    },
    totalDurationPretty() {
      return this.$elapsedPrettyExtended(this.totalDuration)
    }
  },
  methods: {
    showMore(playlistItem) {
      this.$emit('showMore', playlistItem)
    },
    adjustVisibleCount() {
      if (!Array.isArray(this.items) || !this.items.length) {
        this.visibleCount = INITIAL_RENDER_COUNT
        return
      }

      this.visibleCount = Math.min(Math.max(this.visibleCount, INITIAL_RENDER_COUNT), this.items.length)
    },
    setupObserver() {
      if (this.observer) {
        this.observer.disconnect()
        this.observer = null
      }

      if (!this.hasMore || !this.$refs.sentinel) {
        return
      }

      this.observer = new IntersectionObserver(this.handleIntersect, {
        root: null,
        rootMargin: '200px 0px',
        threshold: 0
      })
      this.observer.observe(this.$refs.sentinel)
    },
    disconnectObserver() {
      if (this.observer) {
        this.observer.disconnect()
        this.observer = null
      }
    },
    handleIntersect(entries) {
      if (!Array.isArray(entries)) return
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        if (!Array.isArray(this.items) || !this.items.length) return

        if (this.observer && entry.target) {
          this.observer.unobserve(entry.target)
        }

        this.visibleCount = Math.min(this.visibleCount + CHUNK_SIZE, this.items.length)

        this.$nextTick(() => {
          if (this.hasMore && this.$refs.sentinel && this.observer) {
            this.observer.observe(this.$refs.sentinel)
          } else if (!this.hasMore) {
            this.disconnectObserver()
          }
        })
      })
    }
  },
  watch: {
    items() {
      this.adjustVisibleCount()
      this.$nextTick(() => {
        this.setupObserver()
      })
    }
  },
  mounted() {
    this.adjustVisibleCount()
    this.$nextTick(() => {
      this.setupObserver()
    })
  },
  beforeDestroy() {
    this.disconnectObserver()
  }
}
</script>

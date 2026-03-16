<template>
  <modals-modal v-model="show" :width="width">
    <div class="px-4 pt-2 pb-2">
      <p v-if="title" class="text-md-title-m text-md-on-surface mb-3 truncate">{{ title }}</p>
      <div ref="container" class="w-full overflow-x-hidden overflow-y-auto" style="max-height: 60vh">
        <ul class="w-full" role="listbox" aria-labelledby="listbox-label">
          <template v-for="item in itemsToShow">
            <slot :name="item.value" :item="item" :selected="item.value === selected">
              <li :key="item.value" :ref="`item-${item.value}`" class="text-md-on-surface select-none relative cursor-pointer rounded-md-sm hover:bg-md-on-surface/5" :class="selected === item.value ? 'bg-md-secondary-container' : ''" :style="{ paddingTop: itemPaddingY, paddingBottom: itemPaddingY }" role="option" @click="clickedOption(item.value)">
                <div class="relative flex items-center px-3">
                  <span v-if="item.icon" class="material-symbols text-xl mr-2 text-md-on-surface-variant">{{ item.icon }}</span>
                  <p class="font-normal block truncate text-base text-md-on-surface">{{ item.text }}</p>
                </div>
              </li>
            </slot>
          </template>
        </ul>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    title: String,
    items: {
      type: Array,
      default: () => []
    },
    selected: [String, Number], // optional
    itemPaddingY: {
      type: String,
      default: '16px'
    },
    width: {
      type: [String, Number],
      default: 300
    }
  },
  data() {
    return {}
  },
  watch: {
    show: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.$nextTick(this.init)
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
    itemsToShow() {
      return this.items.map((i) => {
        if (typeof i === 'string') {
          return {
            text: i,
            value: i
          }
        }
        return i
      })
    }
  },
  methods: {
    clickedOption(action) {
      this.$emit('action', action)
    },
    init() {
      if (this.selected && this.$refs[`item-${this.selected}`]?.[0]) {
        // Set scroll position so that selected item is in the center
        const containerOffset = this.$refs.container.offsetTop + this.$refs.container.clientHeight / 2
        const scrollAmount = this.$refs[`item-${this.selected}`][0].offsetTop - containerOffset
        this.$refs.container.scrollTo({
          top: scrollAmount
        })
      }
    }
  },
  mounted() {}
}
</script>

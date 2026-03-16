<template>
  <modals-modal v-model="show" :processing="processing" anchor-selector="[aria-label='Show library modal']">
    <div class="px-4 pt-2 pb-2">
      <p class="text-md-title-m text-md-on-surface mb-3">{{ $strings.HeaderLibraries }}</p>
      <ul class="w-full" role="listbox">
        <template v-for="library in libraries">
          <li
            :key="library.id"
            class="select-none relative rounded-md-md cursor-pointer mb-1"
            :class="currentLibraryId === library.id ? 'bg-md-secondary-container' : 'hover:bg-md-on-surface/5'"
            role="option"
            @click="clickedOption(library)"
          >
            <div v-show="currentLibraryId === library.id" class="absolute top-0 left-0 w-0.5 bg-md-primary rounded-l-md-md h-full" />
            <div class="flex items-center px-3 py-3">
              <ui-library-icon :icon="library.icon" />
              <span class="text-md-body-l text-md-on-surface font-normal block truncate ml-4">{{ library.name }}</span>
            </div>
          </li>
        </template>
      </ul>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.libraries.showModal
      },
      set(val) {
        this.$store.commit('libraries/setShowModal', val)
      }
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    libraries() {
      return this.$store.state.libraries.libraries
    }
  },
  methods: {
    async clickedOption(lib) {
      await this.$hapticsImpact()
      this.show = false
      if (lib.id === this.currentLibraryId) return
      await this.$store.dispatch('libraries/fetch', lib.id)
      this.$eventBus.$emit('library-changed', lib.id)
      this.$localStore.setLastLibraryId(lib.id)
    }
  },
  mounted() {}
}
</script>

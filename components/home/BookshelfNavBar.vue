<template>
  <div class="w-full bg-md-surface-4 relative z-30 elevation-2">
    <nav id="bookshelf-navbar" class="flex h-full pointer-events-auto">
      <nuxt-link
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="flex-1 flex flex-col items-center justify-center py-1 min-h-[56px] relative transition-md-standard"
        :aria-label="item.text"
        :aria-current="routeName === item.routeName ? 'page' : undefined"
      >
        <!-- Active indicator pill -->
        <span
          v-if="routeName === item.routeName"
          class="absolute inset-x-4 top-1 h-8 rounded-md-full bg-md-primary-container"
        />
        <!-- Icon -->
        <span class="relative z-10 flex items-center justify-center h-6">
          <span
            v-if="item.iconPack === 'abs-icons'"
            class="abs-icons"
            :class="[`icon-${item.icon}`, routeName === item.routeName ? 'text-md-on-primary-container text-xl' : 'text-md-on-surface-variant text-xl']"
          />
          <span
            v-else
            :class="[item.iconPack, routeName === item.routeName ? 'text-md-on-primary-container text-xl' : 'text-md-on-surface-variant text-xl']"
          >{{ item.icon }}</span>
        </span>
        <!-- Label — only shown for active tab -->
        <span
          v-if="routeName === item.routeName"
          class="relative z-10 text-md-label-m text-md-on-surface mt-0.5"
        >{{ item.text }}</span>
      </nuxt-link>
    </nav>
  </div>
</template>

<script>
export default {
  data() {
    return {}
  },
  computed: {
    currentLibrary() {
      return this.$store.getters['libraries/getCurrentLibrary']
    },
    currentLibraryIcon() {
      return this.currentLibrary?.icon || 'database'
    },
    userHasPlaylists() {
      const autoUnfinished = this.$store.state.deviceData?.deviceSettings?.autoCacheUnplayedEpisodes
      return this.$store.state.libraries.numUserPlaylists || autoUnfinished
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    items() {
      let items = []
      if (this.isPodcast) {
        items = [
          { to: '/bookshelf', routeName: 'bookshelf', iconPack: 'abs-icons', icon: 'home', text: this.$strings.ButtonHome },
          { to: '/bookshelf/latest', routeName: 'bookshelf-latest', iconPack: 'abs-icons', icon: 'list', text: this.$strings.ButtonLatest },
          { to: '/bookshelf/library', routeName: 'bookshelf-library', iconPack: 'abs-icons', icon: this.currentLibraryIcon, text: this.$strings.ButtonLibrary }
        ]
        if (this.userIsAdminOrUp) {
          items.push({ to: '/bookshelf/add-podcast', routeName: 'bookshelf-add-podcast', iconPack: 'material-symbols', icon: 'podcasts', text: this.$strings.ButtonAdd })
        }
      } else {
        items = [
          { to: '/bookshelf', routeName: 'bookshelf', iconPack: 'abs-icons', icon: 'home', text: this.$strings.ButtonHome },
          { to: '/bookshelf/library', routeName: 'bookshelf-library', iconPack: 'abs-icons', icon: this.currentLibraryIcon, text: this.$strings.ButtonLibrary },
          { to: '/bookshelf/series', routeName: 'bookshelf-series', iconPack: 'abs-icons', icon: 'columns', text: this.$strings.ButtonSeries },
          { to: '/bookshelf/collections', routeName: 'bookshelf-collections', iconPack: 'material-symbols', icon: 'collections_bookmark', text: this.$strings.ButtonCollections },
          { to: '/bookshelf/authors', routeName: 'bookshelf-authors', iconPack: 'abs-icons', icon: 'authors', text: this.$strings.ButtonAuthors }
        ]
      }
      if (this.userHasPlaylists) {
        items.push({ to: '/bookshelf/playlists', routeName: 'bookshelf-playlists', iconPack: 'material-symbols', icon: 'queue_music', text: this.$strings.ButtonPlaylists })
      }
      return items
    },
    routeName() { return this.$route.name },
    isPodcast() { return this.libraryMediaType === 'podcast' },
    libraryMediaType() { return this.$store.getters['libraries/getCurrentLibraryMediaType'] }
  }
}
</script>

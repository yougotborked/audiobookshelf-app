<template>
  <div>
    <div id="bookshelf" class="w-full h-full p-4 overflow-y-auto">
      <div class="flex flex-wrap justify-center">
        <template v-for="author in authors">
          <cards-author-card :key="author.id" :author="author" :width="cardWidth" :height="cardHeight" class="p-2" />
        </template>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: true,
      authors: [],
      loadedLibraryId: null,
      cardWidth: 200
    }
  },
  computed: {
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    networkConnected() {
      return this.$store.state.networkConnected
    },
    cardHeight() {
      return this.cardWidth * 1.25
    }
  },
  methods: {
    async buildLocalAuthors() {
      const localItems = await this.$db.getLocalLibraryItems('book')
      const authorMap = new Map()

      localItems.forEach((item) => {
        const names = item?.media?.metadata?.authors || []
        names.forEach((name) => {
          if (!name) return
          const key = name.toLowerCase()
          if (!authorMap.has(key)) {
            authorMap.set(key, {
              id: `local_author_${key}`,
              name,
              displayName: name,
              books: 0,
              numAudiobooks: 0,
              libraryId: this.currentLibraryId
            })
          }
          const entry = authorMap.get(key)
          entry.books += 1
          entry.numAudiobooks += 1
        })
      })

      return Array.from(authorMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    },
    async init() {
      this.cardWidth = (window.innerWidth - 64) / 2
      if (!this.currentLibraryId) {
        return
      }
      this.loadedLibraryId = this.currentLibraryId
      let authors = []

      if (this.networkConnected) {
        authors = await this.$nativeHttp
          .get(`/api/libraries/${this.currentLibraryId}/authors`)
          .then((response) => response.authors)
          .catch((error) => {
            console.error('Failed to load authors', error)
            return []
          })

        if (authors.length) {
          await this.$localStore.setCachedAuthors(this.currentLibraryId, authors)
        }
      }

      if (!authors.length) {
        authors = await this.$localStore.getCachedAuthors(this.currentLibraryId)
      }

      if (!authors.length) {
        authors = await this.buildLocalAuthors()
      }

      this.authors = authors
      console.log('Loaded authors', this.authors)
      this.$eventBus.$emit('bookshelf-total-entities', this.authors.length)
      this.loading = false
    },
    authorAdded(author) {
      if (!this.authors.some((au) => au.id === author.id)) {
        this.authors.push(author)
        this.$eventBus.$emit('bookshelf-total-entities', this.authors.length)
      }
    },
    authorUpdated(author) {
      this.authors = this.authors.map((au) => {
        if (au.id === author.id) {
          return author
        }
        return au
      })
    },
    authorRemoved(author) {
      this.authors = this.authors.filter((au) => au.id !== author.id)
      this.$eventBus.$emit('bookshelf-total-entities', this.authors.length)
    },
    libraryChanged(libraryId) {
      if (libraryId !== this.loadedLibraryId) {
        if (this.$store.getters['libraries/getCurrentLibraryMediaType'] === 'book') {
          this.init()
        } else {
          this.$router.replace('/bookshelf')
        }
      }
    }
  },
  mounted() {
    this.init()
    this.$socket.$on('author_added', this.authorAdded)
    this.$socket.$on('author_updated', this.authorUpdated)
    this.$socket.$on('author_removed', this.authorRemoved)
    this.$eventBus.$on('library-changed', this.libraryChanged)
  },
  beforeDestroy() {
    this.$socket.$off('author_added', this.authorAdded)
    this.$socket.$off('author_updated', this.authorUpdated)
    this.$socket.$off('author_removed', this.authorRemoved)
    this.$eventBus.$off('library-changed', this.libraryChanged)
  }
}
</script>

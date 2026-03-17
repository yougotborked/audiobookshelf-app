<template>
  <div id="bookshelf" class="w-full max-w-full h-full bg-md-surface-0">
    <template v-for="shelf in totalShelves">
      <div :key="shelf" class="w-full px-2 relative" :class="showBookshelfListView || altViewEnabled ? '' : 'bookshelfRow'" :id="`shelf-${shelf - 1}`" :style="{ height: shelfHeight + 'px' }">
        <div v-if="!showBookshelfListView && !altViewEnabled" class="w-full absolute bottom-0 left-0 z-30 bookshelfDivider" style="min-height: 16px" :class="`h-${shelfDividerHeightIndex}`" />
        <div v-else-if="showBookshelfListView" class="flex border-t border-white border-opacity-10" />
      </div>
    </template>

    <div v-show="!entities.length && initialized" class="w-full py-16 flex flex-col items-center gap-3">
      <span class="material-symbols text-5xl text-md-on-surface-variant/40">library_books</span>
      <p v-if="page === 'collections'" class="text-md-body-l text-md-on-surface-variant">{{ $strings.MessageNoCollections }}</p>
      <p v-else class="text-md-body-l text-md-on-surface-variant capitalize">No {{ entityName }}</p>
      <ui-btn v-if="hasFilter" variant="outlined" @click="clearFilter">{{ $strings.ButtonClearFilter }}</ui-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, onUpdated } from 'vue'
import { useUserStore } from '@/stores/user'
import { useLibrariesStore } from '@/stores/libraries'
import { useAppStore } from '@/stores/app'
import { useGlobalsStore } from '@/stores/globals'
import { useEventBus } from '@/composables/useEventBus'
import { useSocket } from '@/composables/useSocket'
import { useNativeHttp } from '@/composables/useNativeHttp'
import { useDb } from '@/composables/useDb'
import { useLocalStore } from '@/composables/useLocalStore'
import { useRouter } from 'vue-router'
import { useUtils } from '@/composables/useUtils'
import { useBookshelfCards } from '@/composables/useBookshelfCards'

const props = defineProps<{
  page: string
  seriesId?: string
}>()

const userStore = useUserStore()
const librariesStore = useLibrariesStore()
const appStore = useAppStore()
const globalsStore = useGlobalsStore()
const eventBus = useEventBus()
const socket = useSocket()
const nativeHttp = useNativeHttp()
const db = useDb()
const localStore = useLocalStore()
const router = useRouter()
const { encode } = useUtils()

// State
const routeFullPath = ref<string | null>(null)
const entitiesPerShelf = ref(2)
const bookshelfHeight = ref(0)
const bookshelfWidth = ref(0)
const bookshelfMarginLeft = ref(0)
const shelvesPerPage = ref(0)
const currentPage = ref(0)
const booksPerFetch = ref(20)
const initialized = ref(false)
const currentSFQueryString = ref<string | null>(null)
const isFetchingEntities = ref(false)
const entities = ref<Record<string, unknown>[]>([])
const totalEntities = ref(0)
const totalShelves = ref(0)
const pagesLoaded = ref<Record<number, boolean>>({})
const isFirstInit = ref(false)
const pendingReset = ref(false)
const localLibraryItems = ref<Record<string, unknown>[]>([])
const localLibraryItemMap = ref<Map<string, Record<string, unknown>> | null>(new Map())

// Computed
const user = computed(() => userStore.user)
const entityName = computed(() => props.page)
const isBookEntity = computed(() => entityName.value === 'books' || entityName.value === 'series-books')
const shelfDividerHeightIndex = computed(() => (isBookEntity.value ? 4 : 6))
const bookshelfListView = computed(() => globalsStore.bookshelfListView)
const showBookshelfListView = computed(() => isBookEntity.value && bookshelfListView.value)
const sortingIgnorePrefix = computed(() => appStore.getServerSetting('sortingIgnorePrefix'))
const hasFilter = computed(() => {
  if (props.page === 'series' || props.page === 'collections' || props.page === 'playlists') return false
  return filterBy.value !== 'all'
})
const orderBy = computed(() => userStore.getUserSetting('mobileOrderBy'))
const orderDesc = computed(() => userStore.getUserSetting('mobileOrderDesc'))
const filterBy = computed(() => userStore.getUserSetting('mobileFilterBy'))
const collapseSeries = computed(() => userStore.getUserSetting('collapseSeries'))
const collapseBookSeries = computed(() => userStore.getUserSetting('collapseBookSeries'))
const bookCoverAspectRatio = computed(() => globalsStore.getBookCoverAspectRatio)
const isCoverSquareAspectRatio = computed(() => bookCoverAspectRatio.value === 1)
const bookWidth = computed(() => {
  const availableWidth = window.innerWidth - 16
  let coverSize = 100
  // Smaller screens fill width with 2 items per row
  if (availableWidth <= 400) {
    coverSize = Math.floor(availableWidth / 2 - 24)
    if (coverSize < 120) {
      // Fallback to 1 item per row
      coverSize = Math.min(availableWidth - 24, 200)
    }
    if (isCoverSquareAspectRatio.value || entityName.value === 'playlists') coverSize /= 1.6
  }
  if (isCoverSquareAspectRatio.value || entityName.value === 'playlists') return coverSize * 1.6
  return coverSize
})
const bookHeight = computed(() => {
  if (isCoverSquareAspectRatio.value || entityName.value === 'playlists') return bookWidth.value
  return bookWidth.value * 1.6
})
const entityWidth = computed(() => {
  if (showBookshelfListView.value) return bookshelfWidth.value - 16
  if (isBookEntity.value || entityName.value === 'playlists') return bookWidth.value
  return bookWidth.value * 2
})
const entityHeight = computed(() => {
  if (showBookshelfListView.value) return 88
  return bookHeight.value
})
const currentLibraryId = computed(() => librariesStore.currentLibraryId)
const currentLibraryMediaType = computed(() => librariesStore.getCurrentLibraryMediaType)
const networkConnected = computed(() => appStore.networkConnected)
const altViewEnabled = computed(() => appStore.getAltViewEnabled)
const sizeMultiplier = computed(() => {
  const baseSize = isCoverSquareAspectRatio.value ? 192 : 120
  return entityWidth.value / baseSize
})
const shelfHeight = computed(() => {
  if (showBookshelfListView.value) return entityHeight.value + 16
  if (altViewEnabled.value) {
    var extraTitleSpace = isBookEntity.value ? 80 : 40
    return entityHeight.value + extraTitleSpace * sizeMultiplier.value
  }
  return entityHeight.value + 40
})
const totalEntityCardWidth = computed(() => {
  if (showBookshelfListView.value) return entityWidth.value
  // Includes margin
  return entityWidth.value + 24
})

// useBookshelfCards composable
const { entityIndexesMounted, entityComponentRefs, mountEntityCard, cardsHelpers } = useBookshelfCards({
  entityName,
  entitiesPerShelf,
  entityWidth,
  entityHeight,
  totalEntityCardWidth,
  bookshelfMarginLeft,
  bookCoverAspectRatio,
  altViewEnabled,
  showBookshelfListView,
  isBookEntity,
  entities,
  localLibraryItems,
  localLibraryItemMap,
  filterBy,
  orderBy,
  sortingIgnorePrefix
})

// Watches
watch(showBookshelfListView, () => {
  resetEntities()
})
watch(() => props.seriesId, () => {
  resetEntities()
})

// Methods
function buildLocalLibraryItemMap(items: Record<string, unknown>[] = []) {
  const map = new Map<string, Record<string, unknown>>()
  items.forEach((item) => {
    if (item?.libraryItemId) {
      map.set(item.libraryItemId as string, item)
    }
  })
  return map
}

function clearFilter() {
  userStore.updateUserSettings({
    mobileFilterBy: 'all'
  })
}

async function fetchEntities(page: number) {
  const startIndex = page * booksPerFetch.value

  isFetchingEntities.value = true

  if (!initialized.value) {
    currentSFQueryString.value = buildSearchParams()
  }

  const entityPath = entityName.value === 'books' || entityName.value === 'series-books' ? `items` : entityName.value
  const sfQueryString = currentSFQueryString.value ? currentSFQueryString.value + '&' : ''
  const fullQueryString = `?${sfQueryString}limit=${booksPerFetch.value}&page=${page}&minified=1&include=rssfeed,numEpisodesIncomplete`

  let payload: { results: Record<string, unknown>[]; total: number } | null
  if (!networkConnected.value) {
    if (entityName.value === 'playlists') {
      const cached = await localStore.getCachedPlaylists(currentLibraryId.value)
      payload = { results: cached.slice(startIndex, startIndex + booksPerFetch.value), total: cached.length }
    } else if (entityName.value === 'books' || entityName.value === 'series-books') {
      const results = localLibraryItems.value.slice(startIndex, startIndex + booksPerFetch.value)
      payload = { results, total: localLibraryItems.value.length }
    } else {
      payload = { results: [], total: 0 }
    }
  } else {
    payload = await nativeHttp.get(`/api/libraries/${currentLibraryId.value}/${entityPath}${fullQueryString}`).catch((error: unknown) => {
      console.error('failed to fetch books', error)
      return null
    })
    if (payload && entityName.value === 'playlists' && payload.results) {
      localStore.setCachedPlaylists(currentLibraryId.value, payload.results)
    }
  }

  isFetchingEntities.value = false
  if (pendingReset.value) {
    pendingReset.value = false
    resetEntities()
    return
  }
  if (payload && payload.results) {
    console.log('Received payload', payload)
    if (!initialized.value) {
      initialized.value = true
      totalEntities.value = payload.total
      totalShelves.value = Math.ceil(totalEntities.value / entitiesPerShelf.value)
      entities.value = new Array(totalEntities.value)
      eventBus.emit('bookshelf-total-entities', totalEntities.value)
    }

    for (let i = 0; i < payload.results.length; i++) {
      const index = i + startIndex
      entities.value[index] = payload.results[i]
      if (entityComponentRefs.value[index]) {
        entityComponentRefs.value[index].setEntity(entities.value[index])

        if (isBookEntity.value) {
          const localLibraryItem = localLibraryItemMap.value?.get(entities.value[index].id as string)
          if (localLibraryItem) {
            entityComponentRefs.value[index].setLocalLibraryItem(localLibraryItem)
          }
        }
      }
    }
  }
}

async function loadPage(page: number) {
  if (networkConnected.value && !currentLibraryId.value) {
    console.error('[LazyBookshelf] loadPage current library id not set')
    return
  }
  pagesLoaded.value[page] = true
  await fetchEntities(page)
}

function mountEntites(fromIndex: number, toIndex: number) {
  for (let i = fromIndex; i < toIndex; i++) {
    if (!entityIndexesMounted.value.includes(i)) {
      cardsHelpers.mountEntityCard(i)
    }
  }
}

function handleScroll(scrollTop: number) {
  var firstShelfIndex = Math.floor(scrollTop / shelfHeight.value)
  var lastShelfIndex = Math.ceil((scrollTop + bookshelfHeight.value) / shelfHeight.value)
  lastShelfIndex = Math.min(totalShelves.value - 1, lastShelfIndex)

  var firstBookIndex = firstShelfIndex * entitiesPerShelf.value
  var lastBookIndex = lastShelfIndex * entitiesPerShelf.value + entitiesPerShelf.value
  lastBookIndex = Math.min(totalEntities.value, lastBookIndex)

  var firstBookPage = Math.floor(firstBookIndex / booksPerFetch.value)
  var lastBookPage = Math.floor(lastBookIndex / booksPerFetch.value)
  if (!pagesLoaded.value[firstBookPage]) {
    loadPage(firstBookPage)
  }
  if (!pagesLoaded.value[lastBookPage]) {
    loadPage(lastBookPage)
  }

  // Remove entities out of view
  entityIndexesMounted.value = entityIndexesMounted.value.filter((_index) => {
    if (_index < firstBookIndex || _index >= lastBookIndex) {
      var el = document.getElementById(`book-card-${_index}`)
      if (el) el.remove()
      return false
    }
    return true
  })
  mountEntites(firstBookIndex, lastBookIndex)
}

function destroyEntityComponents() {
  for (const key in entityComponentRefs.value) {
    if (entityComponentRefs.value[key] && entityComponentRefs.value[key].destroy) {
      entityComponentRefs.value[key].destroy()
    }
  }
}

function setDownloads() {
  if (entityName.value === 'books') {
    entities.value = []
    // TOOD: Sort and filter here
    totalEntities.value = entities.value.length
    totalShelves.value = Math.ceil(totalEntities.value / entitiesPerShelf.value)
  } else {
    // TODO: Support offline series and collections
    entities.value = []
    totalEntities.value = 0
    totalShelves.value = 0
  }
  eventBus.emit('bookshelf-total-entities', totalEntities.value)
}

async function resetEntities() {
  if (isFetchingEntities.value) {
    pendingReset.value = true
    return
  }
  destroyEntityComponents()
  entityIndexesMounted.value = []
  entityComponentRefs.value = {}
  pagesLoaded.value = {}
  entities.value = []
  totalShelves.value = 0
  totalEntities.value = 0
  currentPage.value = 0
  initialized.value = false

  initSizeData()
  if (user.value) {
    await loadPage(0)
    var lastBookIndex = Math.min(totalEntities.value, shelvesPerPage.value * entitiesPerShelf.value)
    mountEntites(0, lastBookIndex)
  } else {
    // Local only
  }
}

function remountEntities() {
  // Remount when an entity is removed
  for (const key in entityComponentRefs.value) {
    if (entityComponentRefs.value[key]) {
      entityComponentRefs.value[key].destroy()
    }
  }
  entityComponentRefs.value = {}
  entityIndexesMounted.value.forEach((i) => {
    cardsHelpers.mountEntityCard(i)
  })
}

function initSizeData() {
  var bookshelf = document.getElementById('bookshelf')
  if (!bookshelf) {
    console.error('Failed to init size data')
    return
  }
  var entitiesPerShelfBefore = entitiesPerShelf.value

  var { clientHeight, clientWidth } = bookshelf
  bookshelfHeight.value = clientHeight
  bookshelfWidth.value = clientWidth
  entitiesPerShelf.value = Math.max(1, showBookshelfListView.value ? 1 : Math.floor((bookshelfWidth.value - 16) / totalEntityCardWidth.value))
  shelvesPerPage.value = Math.ceil(bookshelfHeight.value / shelfHeight.value) + 2
  bookshelfMarginLeft.value = (bookshelfWidth.value - entitiesPerShelf.value * totalEntityCardWidth.value) / 2

  const entitiesPerPage = shelvesPerPage.value * entitiesPerShelf.value
  booksPerFetch.value = Math.ceil(entitiesPerPage / 20) * 20 // Round up to the nearest 20

  if (totalEntities.value) {
    totalShelves.value = Math.ceil(totalEntities.value / entitiesPerShelf.value)
  }
  return entitiesPerShelfBefore < entitiesPerShelf.value // Books per shelf has changed
}

async function init() {
  if (isFirstInit.value) return
  if (!user.value) {
    // Offline support not available
    await resetEntities()
    eventBus.emit('bookshelf-total-entities', 0)
    return
  }

  localLibraryItems.value = await db.getLocalLibraryItems(currentLibraryMediaType.value)
  localLibraryItemMap.value = buildLocalLibraryItemMap(localLibraryItems.value)
  console.log('Local library items loaded for lazy bookshelf', localLibraryItems.value.length)

  isFirstInit.value = true
  initSizeData()
  await loadPage(0)
  var lastBookIndex = Math.min(totalEntities.value, shelvesPerPage.value * entitiesPerShelf.value)
  mountEntites(0, lastBookIndex)

  // Set last scroll position for this bookshelf page
  if (appStore.lastBookshelfScrollData[props.page] && window['bookshelf-wrapper']) {
    const { path, scrollTop } = appStore.lastBookshelfScrollData[props.page]
    if (path === routeFullPath.value) {
      // Exact path match with query so use scroll position
      window['bookshelf-wrapper'].scrollTop = scrollTop
    }
  }
}

function scroll(e: Event) {
  if (!e || !e.target) return
  if (!user.value) return
  var { scrollTop } = e.target as HTMLElement
  handleScroll(scrollTop)
}

function buildSearchParams() {
  if (props.page === 'search' || props.page === 'collections') {
    return ''
  } else if (props.page === 'series') {
    // Sort by name ascending
    let searchParams = new URLSearchParams()
    searchParams.set('sort', 'name')
    searchParams.set('desc', '0')
    return searchParams.toString()
  }

  let searchParams = new URLSearchParams()
  if (props.page === 'series-books') {
    searchParams.set('filter', `series.${encode(props.seriesId ?? '')}`)
    if (collapseBookSeries.value) {
      searchParams.set('collapseseries', '1')
    }
  } else {
    if (filterBy.value && filterBy.value !== 'all') {
      searchParams.set('filter', filterBy.value)
    }
    if (orderBy.value) {
      searchParams.set('sort', orderBy.value)
      searchParams.set('desc', orderDesc.value ? '1' : '0')
    }
    if (collapseSeries.value) {
      searchParams.set('collapseseries', '1')
    }
  }
  return searchParams.toString()
}

function checkUpdateSearchParams() {
  const newSearchParams = buildSearchParams()
  let currentQueryString = window.location.search
  if (currentQueryString && currentQueryString.startsWith('?')) currentQueryString = currentQueryString.slice(1)

  if (newSearchParams === '' && !currentQueryString) {
    return false
  }
  if (newSearchParams !== currentSFQueryString.value || newSearchParams !== currentQueryString) {
    const queryString = newSearchParams ? `?${newSearchParams}` : ''
    let newurl = window.location.protocol + '//' + window.location.host + window.location.pathname + queryString
    window.history.replaceState({ path: newurl }, '', newurl)

    routeFullPath.value = window.location.pathname + (window.location.search || '') // Update for saving scroll position
    return true
  }

  return false
}

function settingsUpdated(_settings?: unknown) {
  const wasUpdated = checkUpdateSearchParams()
  if (wasUpdated) {
    resetEntities()
  }
}

function libraryChanged() {
  if (currentLibraryMediaType.value !== 'book' && (props.page === 'series' || props.page === 'collections' || props.page === 'series-books')) {
    router.replace('/bookshelf')
    return
  }

  if (hasFilter.value) {
    clearFilter()
  } else {
    resetEntities()
  }
}

function libraryItemAdded(libraryItem: Record<string, unknown>) {
  console.log('libraryItem added', libraryItem)
  // TODO: Check if item would be on this shelf
  resetEntities()
}

function libraryItemUpdated(libraryItem: Record<string, unknown>) {
  console.log('Item updated', libraryItem)
  if (entityName.value === 'books' || entityName.value === 'series-books') {
    var indexOf = entities.value.findIndex((ent) => ent && ent.id === libraryItem.id)
    if (indexOf >= 0) {
      entities.value[indexOf] = libraryItem
      if (entityComponentRefs.value[indexOf]) {
        entityComponentRefs.value[indexOf].setEntity(libraryItem)

        if (isBookEntity.value) {
          const localLibraryItem = localLibraryItemMap.value?.get(libraryItem.id as string)
          if (localLibraryItem) {
            entityComponentRefs.value[indexOf].setLocalLibraryItem(localLibraryItem)
          }
        }
      }
    }
  }
}

function libraryItemRemoved(libraryItem: Record<string, unknown>) {
  if (entityName.value === 'books' || entityName.value === 'series-books') {
    var indexOf = entities.value.findIndex((ent) => ent && ent.id === libraryItem.id)
    if (indexOf >= 0) {
      entities.value = entities.value.filter((ent) => ent.id !== libraryItem.id)
      totalEntities.value = entities.value.length
      eventBus.emit('bookshelf-total-entities', totalEntities.value)
      remountEntities()
    }
  }
}

function libraryItemsAdded(libraryItems: Record<string, unknown>[]) {
  console.log('items added', libraryItems)
  // TODO: Check if item would be on this shelf
  resetEntities()
}

function libraryItemsUpdated(libraryItems: Record<string, unknown>[]) {
  libraryItems.forEach((ab) => {
    libraryItemUpdated(ab)
  })
}

function screenOrientationChange() {
  setTimeout(() => {
    console.log('LazyBookshelf Screen orientation change')
    resetEntities()
  }, 50)
}

function initListeners() {
  const bookshelf = document.getElementById('bookshelf-wrapper')
  if (bookshelf) {
    bookshelf.addEventListener('scroll', scroll)
  }

  eventBus.on('library-changed', libraryChanged)
  eventBus.on('user-settings', settingsUpdated)

  socket.on('item_updated', libraryItemUpdated)
  socket.on('item_added', libraryItemAdded)
  socket.on('item_removed', libraryItemRemoved)
  socket.on('items_updated', libraryItemsUpdated)
  socket.on('items_added', libraryItemsAdded)

  if (screen.orientation) {
    // Not available on ios
    screen.orientation.addEventListener('change', screenOrientationChange)
  } else {
    document.addEventListener('orientationchange', screenOrientationChange)
  }
}

function removeListeners() {
  const bookshelf = document.getElementById('bookshelf-wrapper')
  if (bookshelf) {
    bookshelf.removeEventListener('scroll', scroll)
  }

  eventBus.off('library-changed', libraryChanged)
  eventBus.off('user-settings', settingsUpdated)

  socket.off('item_updated', libraryItemUpdated)
  socket.off('item_added', libraryItemAdded)
  socket.off('item_removed', libraryItemRemoved)
  socket.off('items_updated', libraryItemsUpdated)
  socket.off('items_added', libraryItemsAdded)

  if (screen.orientation) {
    // Not available on ios
    screen.orientation.removeEventListener('change', screenOrientationChange)
  } else {
    document.removeEventListener('orientationchange', screenOrientationChange)
  }
}

// Lifecycle
onUpdated(() => {
  routeFullPath.value = window.location.pathname + (window.location.search || '')
})

onMounted(() => {
  routeFullPath.value = window.location.pathname + (window.location.search || '')
  init()
  initListeners()
})

onBeforeUnmount(() => {
  removeListeners()

  // Set bookshelf scroll position for specific bookshelf page and query
  if (window['bookshelf-wrapper']) {
    appStore.lastBookshelfScrollData[props.page] = { scrollTop: (window['bookshelf-wrapper'] as HTMLElement).scrollTop || 0, path: routeFullPath.value ?? '' }
  }
})

defineExpose({ init, handleScroll, resetEntities, settingsUpdated, libraryChanged })
</script>

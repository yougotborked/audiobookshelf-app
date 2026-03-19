import { defineStore } from 'pinia'
import { BookCoverAspectRatio } from '~/constants'

interface DownloadItem {
  id: string
  libraryItemId: string
  episodeId?: string | null
  downloadItemParts: DownloadItemPart[]
  itemProgress: number
  [key: string]: unknown
}

interface DownloadItemPart {
  id: string
  downloadItemId: string
  filename: string
  bytesDownloaded: number
  fileSize: number
  completed: boolean
  [key: string]: unknown
}

interface LocalMediaProgress {
  id: string
  localLibraryItemId: string
  localEpisodeId?: string | null
  libraryItemId?: string
  episodeId?: string | null
  [key: string]: unknown
}

interface GlobalsState {
  isModalOpen: boolean
  itemDownloads: DownloadItem[]
  bookshelfListView: boolean
  series: unknown | null
  localMediaProgress: LocalMediaProgress[]
  lastSearch: string | null
  jumpForwardSecondsOptions: number[]
  jumpBackwardsSecondsOptions: number[]
  libraryIcons: string[]
  selectedPlaylistItems: unknown[]
  showPlaylistsAddCreateModal: boolean
  showSelectLocalFolderModal: boolean
  localFolderSelectData: unknown | null
  hapticFeedback: string
  showRSSFeedOpenCloseModal: boolean
  rssFeedEntity: unknown | null
}

export const useGlobalsStore = defineStore('globals', {
  state: (): GlobalsState => ({
    isModalOpen: false,
    itemDownloads: [],
    bookshelfListView: false,
    series: null,
    localMediaProgress: [],
    lastSearch: null,
    jumpForwardSecondsOptions: [5, 10, 15, 30, 60, 120, 300],
    jumpBackwardsSecondsOptions: [5, 10, 15, 30, 60, 120, 300],
    libraryIcons: ['database', 'audiobookshelf', 'books-1', 'books-2', 'book-1', 'microphone-1', 'microphone-3', 'radio', 'podcast', 'rss', 'headphones', 'music', 'file-picture', 'rocket', 'power', 'star', 'heart'],
    selectedPlaylistItems: [],
    showPlaylistsAddCreateModal: false,
    showSelectLocalFolderModal: false,
    localFolderSelectData: null,
    hapticFeedback: 'LIGHT',
    showRSSFeedOpenCloseModal: false,
    rssFeedEntity: null
  }),

  getters: {
    getDownloadItem: (state) => (libraryItemId: string, episodeId: string | null = null) => {
      return state.itemDownloads.find((i) => {
        if (episodeId && i.episodeId !== episodeId) return false
        return i.libraryItemId == libraryItemId
      })
    },
    getLibraryItemCoverSrc: () => (libraryItem: Record<string, unknown> | null, placeholder: string, raw = false) => {
      if (!libraryItem) return placeholder
      const media = libraryItem.media as Record<string, unknown>
      if (!media || !media.coverPath || media.coverPath === placeholder) return placeholder
      const coverPath = media.coverPath as string
      if (coverPath.startsWith('http:') || coverPath.startsWith('https:')) return coverPath

      const userStore = useUserStore()
      const appStore = useAppStore()
      const serverAddress = userStore.serverConnectionConfig?.address
      if (!serverAddress) return placeholder

      const lastUpdate = (libraryItem.updatedAt as number) || Date.now()
      const url = new URL(`${serverAddress}/api/items/${libraryItem.id}/cover`)
      const urlQuery = new URLSearchParams()
      urlQuery.append('ts', String(lastUpdate))
      if (raw) urlQuery.append('raw', '1')
      if (appStore.getDoesServerImagesRequireToken) {
        urlQuery.append('token', userStore.accessToken || '')
      }
      return `${url}?${urlQuery}`
    },
    getLibraryItemCoverSrcById: () => (libraryItemId: string, placeholder: string | null = null) => {
      const userStore = useUserStore()
      const appStore = useAppStore()
      if (!placeholder) placeholder = '/book_placeholder.jpg'
      if (!libraryItemId) return placeholder
      const serverAddress = userStore.serverConnectionConfig?.address
      if (!serverAddress) return placeholder
      const url = new URL(`${serverAddress}/api/items/${libraryItemId}/cover`)
      if (appStore.getDoesServerImagesRequireToken) {
        return `${url}?token=${userStore.accessToken}`
      }
      return url.toString()
    },
    getLocalMediaProgressById: (state) => (localLibraryItemId: string, episodeId: string | null = null) => {
      return state.localMediaProgress.find((lmp) => {
        if (episodeId != null && lmp.localEpisodeId != episodeId) return false
        return lmp.localLibraryItemId == localLibraryItemId
      })
    },
    getLocalMediaProgressByServerItemId: (state) => (libraryItemId: string, episodeId: string | null = null) => {
      return state.localMediaProgress.find((lmp) => {
        if (episodeId != null && lmp.episodeId != episodeId) return false
        return lmp.libraryItemId == libraryItemId
      })
    },
    getBookCoverAspectRatio: () => {
      const librariesStore = useLibrariesStore()
      const settings = librariesStore.getCurrentLibrary?.settings as Record<string, unknown> | undefined
      if (isNaN(settings?.coverAspectRatio as number)) return 1
      return (settings?.coverAspectRatio as number) === BookCoverAspectRatio.STANDARD ? 1.6 : 1
    }
  },

  actions: {
    async loadLocalMediaProgress() {
      const db = useDb()
      const mediaProgress = await db.getAllLocalMediaProgress()
      this.localMediaProgress = mediaProgress as LocalMediaProgress[]
    },

    addUpdateItemDownload(downloadItem: DownloadItem) {
      const index = this.itemDownloads.findIndex((i) => i.id == downloadItem.id)
      if (index >= 0) {
        this.itemDownloads.splice(index, 1, downloadItem)
      } else {
        this.itemDownloads.push(downloadItem)
      }
    },

    updateDownloadItemPart(downloadItemPart: DownloadItemPart) {
      const downloadItem = this.itemDownloads.find((i) => i.id == downloadItemPart.downloadItemId)
      if (!downloadItem) {
        console.error('updateDownloadItemPart: Download item not found for itemPart', JSON.stringify(downloadItemPart))
        return
      }
      let totalBytes = 0
      let totalBytesDownloaded = 0
      downloadItem.downloadItemParts = downloadItem.downloadItemParts.map((dip) => {
        const newDip = dip.id == downloadItemPart.id ? downloadItemPart : dip
        totalBytes += newDip.completed ? Number(newDip.bytesDownloaded) : Number(newDip.fileSize)
        totalBytesDownloaded += Number(newDip.bytesDownloaded)
        return newDip
      })
      if (totalBytes > 0) {
        downloadItem.itemProgress = Math.min(1, totalBytesDownloaded / totalBytes)
      } else {
        downloadItem.itemProgress = 0
      }
    },

    removeItemDownload(id: string) {
      this.itemDownloads = this.itemDownloads.filter((i) => i.id != id)
    },

    updateLocalMediaProgress(prog: LocalMediaProgress) {
      if (!prog || !prog.id) return
      const index = this.localMediaProgress.findIndex((lmp) => lmp.id == prog.id)
      if (index >= 0) {
        this.localMediaProgress.splice(index, 1, prog)
      } else {
        this.localMediaProgress.push(prog)
      }
    },

    removeLocalMediaProgress(id: string) {
      this.localMediaProgress = this.localMediaProgress.filter((lmp) => lmp.id != id)
    },

    removeLocalMediaProgressForItem(llid: string) {
      this.localMediaProgress = this.localMediaProgress.filter((lmp) => lmp.localLibraryItemId !== llid)
    },

    showSelectLocalFolderModalAction(data: unknown) {
      this.localFolderSelectData = data
      this.showSelectLocalFolderModal = true
    },

    setRSSFeedOpenCloseModal(entity: unknown) {
      this.rssFeedEntity = entity
      this.showRSSFeedOpenCloseModal = true
    },

    showReaderAction({ libraryItem, keepProgress, fileId }: { libraryItem: Record<string, unknown>; keepProgress: boolean; fileId: string }) {
      const appStore = useAppStore()
      appStore.selectedLibraryItem = libraryItem
      appStore.ereaderKeepProgress = keepProgress
      appStore.ereaderFileId = fileId
      appStore.showReader = true
    }
  }
})

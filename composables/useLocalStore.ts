import { Preferences } from '@capacitor/preferences'

class LocalStorage {
  private _userId: string | null = null

  setUserId(id: string | null) {
    this._userId = id
  }

  /** Returns a user-namespaced key when a user is active, otherwise the bare key. */
  private ukey(key: string): string {
    return this._userId ? `u_${this._userId}_${key}` : key
  }

  async setUserSettings(settings: Record<string, unknown>): Promise<void> {
    try {
      await Preferences.set({ key: this.ukey('userSettings'), value: JSON.stringify(settings) })
    } catch (error) {
      console.error('[LocalStorage] Failed to update user settings', error)
    }
  }

  async getUserSettings(): Promise<Record<string, unknown> | null> {
    try {
      const settingsObj = (await Preferences.get({ key: this.ukey('userSettings') })) || {}
      return settingsObj.value ? JSON.parse(settingsObj.value) : null
    } catch (error) {
      console.error('[LocalStorage] Failed to get user settings', error)
      return null
    }
  }

  async setServerSettings(settings: Record<string, unknown> | null): Promise<void> {
    try {
      await Preferences.set({ key: 'serverSettings', value: JSON.stringify(settings) })
    } catch (error) {
      console.error('[LocalStorage] Failed to update server settings', error)
    }
  }

  async getServerSettings(): Promise<Record<string, unknown> | null> {
    try {
      const settingsObj = (await Preferences.get({ key: 'serverSettings' })) || {}
      return settingsObj.value ? JSON.parse(settingsObj.value) : null
    } catch (error) {
      console.error('[LocalStorage] Failed to get server settings', error)
      return null
    }
  }

  async setPlayerSettings(playerSettings: Record<string, unknown>): Promise<void> {
    try {
      await Preferences.set({ key: this.ukey('playerSettings'), value: JSON.stringify(playerSettings) })
    } catch (error) {
      console.error('[LocalStorage] Failed to set player settings', error)
    }
  }

  async getPlayerSettings(): Promise<Record<string, unknown> | null> {
    try {
      const playerSettingsObj = (await Preferences.get({ key: this.ukey('playerSettings') })) || {}
      return playerSettingsObj.value ? JSON.parse(playerSettingsObj.value) : null
    } catch (error) {
      console.error('[LocalStorage] Failed to get player settings', error)
      return null
    }
  }

  async setBookshelfListView(useIt: boolean): Promise<void> {
    try {
      await Preferences.set({ key: this.ukey('bookshelfListView'), value: useIt ? '1' : '0' })
    } catch (error) {
      console.error('[LocalStorage] Failed to set bookshelf list view', error)
    }
  }

  async getBookshelfListView(): Promise<boolean> {
    try {
      const obj = (await Preferences.get({ key: this.ukey('bookshelfListView') })) || {}
      return obj.value === '1'
    } catch (error) {
      console.error('[LocalStorage] Failed to get bookshelf list view', error)
      return false
    }
  }

  async setLastLibraryId(libraryId: string): Promise<void> {
    try {
      await Preferences.set({ key: this.ukey('lastLibraryId'), value: libraryId })
    } catch (error) {
      console.error('[LocalStorage] Failed to set last library id', error)
    }
  }

  async removeLastLibraryId(): Promise<void> {
    try {
      await Preferences.remove({ key: this.ukey('lastLibraryId') })
    } catch (error) {
      console.error('[LocalStorage] Failed to remove last library id', error)
    }
  }

  async getLastLibraryId(): Promise<string | null> {
    try {
      const obj = (await Preferences.get({ key: this.ukey('lastLibraryId') })) || {}
      return obj.value || null
    } catch (error) {
      console.error('[LocalStorage] Failed to get last library id', error)
      return null
    }
  }

  async setTheme(theme: string): Promise<void> {
    try {
      await Preferences.set({ key: 'theme', value: theme })
    } catch (error) {
      console.error('[LocalStorage] Failed to set theme', error)
    }
  }

  async getTheme(): Promise<string | null> {
    try {
      const obj = (await Preferences.get({ key: 'theme' })) || {}
      return obj.value || null
    } catch (error) {
      console.error('[LocalStorage] Failed to get theme', error)
      return null
    }
  }

  async setLanguage(lang: string): Promise<void> {
    try {
      await Preferences.set({ key: 'lang', value: lang })
    } catch (error) {
      console.error('[LocalStorage] Failed to set lang', error)
    }
  }

  async getLanguage(): Promise<string | null> {
    try {
      const obj = (await Preferences.get({ key: 'lang' })) || {}
      return obj.value || null
    } catch (error) {
      console.error('[LocalStorage] Failed to get lang', error)
      return null
    }
  }

  async setCachedPlaylist(playlist: Record<string, unknown>): Promise<void> {
    try {
      await Preferences.set({ key: this.ukey(`playlist_${playlist.id}`), value: JSON.stringify(playlist) })
    } catch (error) {
      console.error('[LocalStorage] Failed to cache playlist', error)
    }
  }

  async getCachedPlaylist(id: string): Promise<Record<string, unknown> | null> {
    try {
      const obj = (await Preferences.get({ key: this.ukey(`playlist_${id}`) })) || {}
      return obj.value ? JSON.parse(obj.value) : null
    } catch (error) {
      console.error('[LocalStorage] Failed to get cached playlist', error)
      return null
    }
  }

  async removeCachedPlaylist(id: string): Promise<void> {
    try {
      await Preferences.remove({ key: this.ukey(`playlist_${id}`) })
    } catch (error) {
      console.error('[LocalStorage] Failed to remove cached playlist', error)
    }
  }

  async setCachedCollection(collection: Record<string, unknown>): Promise<void> {
    try {
      if (!collection?.id) return
      await Preferences.set({ key: this.ukey(`collection_${collection.id}`), value: JSON.stringify(collection) })
    } catch (error) {
      console.error('[LocalStorage] Failed to cache collection', error)
    }
  }

  async getCachedCollection(id: string): Promise<Record<string, unknown> | null> {
    try {
      const obj = (await Preferences.get({ key: this.ukey(`collection_${id}`) })) || {}
      return obj.value ? JSON.parse(obj.value) : null
    } catch (error) {
      console.error('[LocalStorage] Failed to get cached collection', error)
      return null
    }
  }

  async setCachedSeries(series: Record<string, unknown>): Promise<void> {
    try {
      if (!series?.id) return
      await Preferences.set({ key: this.ukey(`series_${series.id}`), value: JSON.stringify(series) })
    } catch (error) {
      console.error('[LocalStorage] Failed to cache series', error)
    }
  }

  async getCachedSeries(id: string): Promise<Record<string, unknown> | null> {
    try {
      const obj = (await Preferences.get({ key: this.ukey(`series_${id}`) })) || {}
      return obj.value ? JSON.parse(obj.value) : null
    } catch (error) {
      console.error('[LocalStorage] Failed to get cached series', error)
      return null
    }
  }

  async setCachedPlaylists(libraryId: string, playlists: unknown[]): Promise<void> {
    try {
      await Preferences.set({ key: this.ukey(`playlists_${libraryId}`), value: JSON.stringify(playlists) })
    } catch (error) {
      console.error('[LocalStorage] Failed to cache playlists', error)
    }
  }

  async getCachedPlaylists(libraryId: string): Promise<unknown[]> {
    try {
      const obj = (await Preferences.get({ key: this.ukey(`playlists_${libraryId}`) })) || {}
      return obj.value ? JSON.parse(obj.value) : []
    } catch (error) {
      console.error('[LocalStorage] Failed to get cached playlists', error)
      return []
    }
  }

  async hasCachedPlaylists(): Promise<boolean> {
    try {
      const { keys } = await Preferences.keys()
      const prefix = this._userId ? `u_${this._userId}_playlists_` : 'playlists_'
      for (const key of keys || []) {
        if (key.startsWith(prefix)) {
          const obj = await Preferences.get({ key })
          const playlists = obj.value ? JSON.parse(obj.value) : []
          if (Array.isArray(playlists) && playlists.length) return true
        }
      }
    } catch (error) {
      console.error('[LocalStorage] Failed to check cached playlists', error)
    }
    return false
  }

  async setCachedAuthors(libraryId: string, authors: unknown[]): Promise<void> {
    try {
      if (!libraryId) return
      await Preferences.set({ key: this.ukey(`authors_${libraryId}`), value: JSON.stringify(authors || []) })
    } catch (error) {
      console.error('[LocalStorage] Failed to cache authors', error)
    }
  }

  async getCachedAuthors(libraryId: string): Promise<unknown[]> {
    try {
      if (!libraryId) return []
      const obj = (await Preferences.get({ key: this.ukey(`authors_${libraryId}`) })) || {}
      return obj.value ? JSON.parse(obj.value) : []
    } catch (error) {
      console.error('[LocalStorage] Failed to get cached authors', error)
      return []
    }
  }

  async setCachedLatestEpisodes(libraryId: string, episodes: unknown[]): Promise<void> {
    try {
      await Preferences.set({ key: this.ukey(`latest_${libraryId}`), value: JSON.stringify(episodes) })
    } catch (error) {
      console.error('[LocalStorage] Failed to cache latest episodes', error)
    }
  }

  async getCachedLatestEpisodes(libraryId: string): Promise<unknown[]> {
    try {
      const obj = (await Preferences.get({ key: this.ukey(`latest_${libraryId}`) })) || {}
      return obj.value ? JSON.parse(obj.value) : []
    } catch (error) {
      console.error('[LocalStorage] Failed to get cached latest episodes', error)
      return []
    }
  }

  async setEpisodeMetadata(libraryItemId: string, episodes: unknown[]): Promise<void> {
    try {
      await Preferences.set({ key: this.ukey(`epmeta_${libraryItemId}`), value: JSON.stringify(episodes) })
    } catch (error) {
      console.error('[LocalStorage] Failed to cache episode metadata', error)
    }
  }

  async getEpisodeMetadata(libraryItemId: string): Promise<unknown[]> {
    try {
      const obj = (await Preferences.get({ key: this.ukey(`epmeta_${libraryItemId}`) })) || {}
      return obj.value ? JSON.parse(obj.value) : []
    } catch (error) {
      console.error('[LocalStorage] Failed to get episode metadata', error)
      return []
    }
  }

  async setCachedLibraryItem(libraryItem: Record<string, unknown>): Promise<void> {
    try {
      if (!libraryItem?.id) return
      await Preferences.set({ key: this.ukey(`libraryItem_${libraryItem.id}`), value: JSON.stringify(libraryItem) })
    } catch (error) {
      console.error('[LocalStorage] Failed to cache library item', error)
    }
  }

  async getCachedLibraryItem(id: string): Promise<Record<string, unknown> | null> {
    try {
      const obj = (await Preferences.get({ key: this.ukey(`libraryItem_${id}`) })) || {}
      return obj.value ? JSON.parse(obj.value) : null
    } catch (error) {
      console.error('[LocalStorage] Failed to get cached library item', error)
      return null
    }
  }

  async setPlayQueue(queue: unknown[]): Promise<void> {
    try {
      await Preferences.set({ key: this.ukey('playQueue'), value: JSON.stringify(queue || []) })
    } catch (error) {
      console.error('[LocalStorage] Failed to set play queue', error)
    }
  }

  async getPlayQueue(): Promise<unknown[]> {
    try {
      const obj = (await Preferences.get({ key: this.ukey('playQueue') })) || {}
      return obj.value ? JSON.parse(obj.value) : []
    } catch (error) {
      console.error('[LocalStorage] Failed to get play queue', error)
      return []
    }
  }

  async setQueueIndex(index: number | null): Promise<void> {
    try {
      await Preferences.set({ key: this.ukey('queueIndex'), value: String(index) })
    } catch (error) {
      console.error('[LocalStorage] Failed to set queue index', error)
    }
  }

  async getQueueIndex(): Promise<number | null> {
    try {
      const obj = (await Preferences.get({ key: this.ukey('queueIndex') })) || {}
      if (!obj.value) return null
      const num = Number(obj.value)
      return isNaN(num) ? null : num
    } catch (error) {
      console.error('[LocalStorage] Failed to get queue index', error)
      return null
    }
  }

  async setPlaybackSession(session: Record<string, unknown> | null): Promise<void> {
    try {
      if (session) {
        await Preferences.set({ key: this.ukey('playbackSession'), value: JSON.stringify(session) })
      } else {
        await Preferences.remove({ key: this.ukey('playbackSession') })
      }
    } catch (error) {
      console.error('[LocalStorage] Failed to set playback session', error)
    }
  }

  async getPlaybackSession(): Promise<Record<string, unknown> | null> {
    try {
      const obj = (await Preferences.get({ key: this.ukey('playbackSession') })) || {}
      return obj.value ? JSON.parse(obj.value) : null
    } catch (error) {
      console.error('[LocalStorage] Failed to get playback session', error)
      return null
    }
  }

  async getPreferenceByKey(key: string): Promise<string | null> {
    try {
      const obj = (await Preferences.get({ key })) || {}
      return obj.value || null
    } catch (error) {
      console.error(`[LocalStorage] Failed to get preference "${key}"`, error)
      return null
    }
  }
}

let _localStore: LocalStorage | null = null

export function useLocalStore(): LocalStorage {
  if (!_localStore) _localStore = new LocalStorage()
  return _localStore
}

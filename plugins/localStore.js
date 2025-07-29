import { Preferences } from '@capacitor/preferences'

class LocalStorage {
  constructor(vuexStore) {
    this.vuexStore = vuexStore
  }

  async setUserSettings(settings) {
    try {
      await Preferences.set({ key: 'userSettings', value: JSON.stringify(settings) })
    } catch (error) {
      console.error('[LocalStorage] Failed to update user settings', error)
    }
  }

  async getUserSettings() {
    try {
      const settingsObj = await Preferences.get({ key: 'userSettings' }) || {}
      return settingsObj.value ? JSON.parse(settingsObj.value) : null
    } catch (error) {
      console.error('[LocalStorage] Failed to get user settings', error)
      return null
    }
  }

  async setServerSettings(settings) {
    try {
      await Preferences.set({ key: 'serverSettings', value: JSON.stringify(settings) })
      console.log('Saved server settings', JSON.stringify(settings))
    } catch (error) {
      console.error('[LocalStorage] Failed to update server settings', error)
    }
  }

  async getServerSettings() {
    try {
      var settingsObj = await Preferences.get({ key: 'serverSettings' }) || {}
      return settingsObj.value ? JSON.parse(settingsObj.value) : null
    } catch (error) {
      console.error('[LocalStorage] Failed to get server settings', error)
      return null
    }
  }

  async setPlayerSettings(playerSettings) {
    try {
      await Preferences.set({ key: 'playerSettings', value: JSON.stringify(playerSettings) })
    } catch (error) {
      console.error('[LocalStorage] Failed to set player settings', error)
    }
  }

  async getPlayerSettings() {
    try {
      const playerSettingsObj = await Preferences.get({ key: 'playerSettings' }) || {}
      return playerSettingsObj.value ? JSON.parse(playerSettingsObj.value) : null
    } catch (error) {
      console.error('[LocalStorage] Failed to get player settings', error)
      return false
    }
  }

  async setBookshelfListView(useIt) {
    try {
      await Preferences.set({ key: 'bookshelfListView', value: useIt ? '1' : '0' })
    } catch (error) {
      console.error('[LocalStorage] Failed to set bookshelf list view', error)
    }
  }

  async getBookshelfListView() {
    try {
      var obj = await Preferences.get({ key: 'bookshelfListView' }) || {}
      return obj.value === '1'
    } catch (error) {
      console.error('[LocalStorage] Failed to get bookshelf list view', error)
      return false
    }
  }

  async setLastLibraryId(libraryId) {
    try {
      await Preferences.set({ key: 'lastLibraryId', value: libraryId })
      console.log('[LocalStorage] Set Last Library Id', libraryId)
    } catch (error) {
      console.error('[LocalStorage] Failed to set last library id', error)
    }
  }

  async removeLastLibraryId() {
    try {
      await Preferences.remove({ key: 'lastLibraryId' })
      console.log('[LocalStorage] Remove Last Library Id')
    } catch (error) {
      console.error('[LocalStorage] Failed to remove last library id', error)
    }
  }

  async getLastLibraryId() {
    try {
      var obj = await Preferences.get({ key: 'lastLibraryId' }) || {}
      return obj.value || null
    } catch (error) {
      console.error('[LocalStorage] Failed to get last library id', error)
      return false
    }
  }

  async setTheme(theme) {
    try {
      await Preferences.set({ key: 'theme', value: theme })
      console.log('[LocalStorage] Set theme', theme)
    } catch (error) {
      console.error('[LocalStorage] Failed to set theme', error)
    }
  }

  async getTheme() {
    try {
      var obj = await Preferences.get({ key: 'theme' }) || {}
      return obj.value || null
    } catch (error) {
      console.error('[LocalStorage] Failed to get theme', error)
      return false
    }
  }

  async setLanguage(lang) {
    try {
      await Preferences.set({ key: 'lang', value: lang })
      console.log('[LocalStorage] Set lang', lang)
    } catch (error) {
      console.error('[LocalStorage] Failed to set lang', error)
    }
  }

  async getLanguage() {
    try {
      var obj = await Preferences.get({ key: 'lang' }) || {}
      return obj.value || null
    } catch (error) {
      console.error('[LocalStorage] Failed to get lang', error)
      return false
    }
  }

  async setCachedPlaylist(playlist) {
    try {
      await Preferences.set({
        key: `playlist_${playlist.id}`,
        value: JSON.stringify(playlist)
      })
    } catch (error) {
      console.error('[LocalStorage] Failed to cache playlist', error)
    }
  }

  async getCachedPlaylist(id) {
    try {
      const obj = await Preferences.get({ key: `playlist_${id}` }) || {}
      return obj.value ? JSON.parse(obj.value) : null
    } catch (error) {
      console.error('[LocalStorage] Failed to get cached playlist', error)
      return null
    }
  }

  async removeCachedPlaylist(id) {
    try {
      await Preferences.remove({ key: `playlist_${id}` })
    } catch (error) {
      console.error('[LocalStorage] Failed to remove cached playlist', error)
    }
  }

  async setCachedPlaylists(libraryId, playlists) {
    try {
      await Preferences.set({
        key: `playlists_${libraryId}`,
        value: JSON.stringify(playlists)
      })
    } catch (error) {
      console.error('[LocalStorage] Failed to cache playlists', error)
    }
  }

  async getCachedPlaylists(libraryId) {
    try {
      const obj = await Preferences.get({ key: `playlists_${libraryId}` }) || {}
      return obj.value ? JSON.parse(obj.value) : []
    } catch (error) {
      console.error('[LocalStorage] Failed to get cached playlists', error)
      return []
    }
  }

  async setCachedLatestEpisodes(libraryId, episodes) {
    try {
      await Preferences.set({
        key: `latest_${libraryId}`,
        value: JSON.stringify(episodes)
      })
    } catch (error) {
      console.error('[LocalStorage] Failed to cache latest episodes', error)
    }
  }

  async getCachedLatestEpisodes(libraryId) {
    try {
      const obj = await Preferences.get({ key: `latest_${libraryId}` }) || {}
      return obj.value ? JSON.parse(obj.value) : []
    } catch (error) {
      console.error('[LocalStorage] Failed to get cached latest episodes', error)
      return []
    }
  }

  async setEpisodeMetadata(libraryItemId, episodes) {
    try {
      await Preferences.set({
        key: `epmeta_${libraryItemId}`,
        value: JSON.stringify(episodes)
      })
    } catch (error) {
      console.error('[LocalStorage] Failed to cache episode metadata', error)
    }
  }

  async getEpisodeMetadata(libraryItemId) {
    try {
      const obj = await Preferences.get({ key: `epmeta_${libraryItemId}` }) || {}
      return obj.value ? JSON.parse(obj.value) : []
    } catch (error) {
      console.error('[LocalStorage] Failed to get episode metadata', error)
      return []
    }
  }

  async setPlayQueue(queue) {
    try {
      await Preferences.set({ key: 'playQueue', value: JSON.stringify(queue || []) })
    } catch (error) {
      console.error('[LocalStorage] Failed to set play queue', error)
    }
  }

  async getPlayQueue() {
    try {
      const obj = await Preferences.get({ key: 'playQueue' }) || {}
      return obj.value ? JSON.parse(obj.value) : []
    } catch (error) {
      console.error('[LocalStorage] Failed to get play queue', error)
      return []
    }
  }

  async setQueueIndex(index) {
    try {
      await Preferences.set({ key: 'queueIndex', value: String(index) })
    } catch (error) {
      console.error('[LocalStorage] Failed to set queue index', error)
    }
  }

  async getQueueIndex() {
    try {
      const obj = await Preferences.get({ key: 'queueIndex' }) || {}
      if (!obj.value) return null
      const num = Number(obj.value)
      return isNaN(num) ? null : num
    } catch (error) {
      console.error('[LocalStorage] Failed to get queue index', error)
      return null
    }
  }

/**
   * Get preference value by key
   * 
   * @param {string} key 
   * @returns {Promise<string>}
   */
  async getPreferenceByKey(key) {
    try {
      const obj = await Preferences.get({ key }) || {}
      return obj.value || null
    } catch (error) {
      console.error(`[LocalStorage] Failed to get preference "${key}"`, error)
      return null
    }
  }
}


export default ({ app, store }, inject) => {
  inject('localStore', new LocalStorage(store))
}

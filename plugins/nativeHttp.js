import { CapacitorHttp } from '@capacitor/core'

export default function ({ store, $db, $socket }, inject) {
  const getSafeLogUrl = (url = '') => {
    if (!url || typeof url !== 'string') return url
    const queryStart = url.indexOf('?')
    return queryStart === -1 ? url : url.slice(0, queryStart)
  }

  const nativeHttp = {
    async request(method, _url, data, options = {}) {
      // When authorizing before a config is set, server config gets passed in as an option
      let serverConnectionConfig = options.serverConnectionConfig || store.state.user.serverConnectionConfig
      delete options.serverConnectionConfig

      let url = _url
      let headers = {}
      if (!url.startsWith('http') && !url.startsWith('capacitor')) {
        const bearerToken = store.getters['user/getToken']
        if (bearerToken) {
          headers['Authorization'] = `Bearer ${bearerToken}`
        } else {
          console.warn('[nativeHttp] No Bearer Token for request')
        }
        if (serverConnectionConfig?.address) {
          url = `${serverConnectionConfig.address}${url}`
        }
      }
      if (data) {
        headers['Content-Type'] = 'application/json'
      }
      if (options.headers) {
        headers = { ...headers, ...options.headers }
        delete options.headers
      }
      console.log(`[nativeHttp] Making ${method} request to ${getSafeLogUrl(url)}`)

      try {
        const res = await CapacitorHttp.request({
          method,
          url,
          data,
          headers,
          ...options
        })

        store.commit('setServerReachable', true)

        if (res.status === 401) {
          console.error(`[nativeHttp] 401 status for url "${getSafeLogUrl(url)}"`)
          // Handle refresh token automatically
          return this.handleTokenRefresh(method, url, data, headers, options, serverConnectionConfig)
        }
        if (res.status >= 400) {
          console.error(`[nativeHttp] ${res.status} status for url "${getSafeLogUrl(url)}"`)
          const error = new Error(res.data)
          error.status = res.status
          error.url = url
          throw error
        }
        return res.data
      } catch (error) {
        const status = error?.status ?? error?.response?.status
        const errorCode = (error?.code || '').toString().toUpperCase()
        const message = (error?.message || '').toLowerCase()
        const isLikelyNetworkError =
          status === 0 ||
          ['ERR_NETWORK', 'ECONNABORTED', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(errorCode) ||
          message.includes('network') ||
          message.includes('connection') ||
          message.includes('timed out') ||
          message.includes('offline')

        if (typeof status === 'number' && status >= 400 && !isLikelyNetworkError) {
          store.commit('setServerReachable', true)
        } else if (isLikelyNetworkError) {
          store.commit('setServerReachable', false)
        }

        throw error
      }
    },

    /**
     * Handles token refresh when a 401 Unauthorized response is received
     * @param {string} method - HTTP method
     * @param {string} url - Full URL
     * @param {*} data - Request data
     * @param {Object} headers - Request headers
     * @param {Object} options - Additional options
     * @param {{ id: string, address: string, version: string }} serverConnectionConfig
     * @returns {Promise} - Promise that resolves with the response data
     */
    async handleTokenRefresh(method, url, data, headers, options, serverConnectionConfig) {
      try {
        console.log('[nativeHttp] Attempting to refresh token...')

        if (!serverConnectionConfig?.id) {
          console.error('[nativeHttp] No server connection config ID available for token refresh')
          throw new Error('No server connection available')
        }

        // Get refresh token from secure storage
        const refreshToken = await $db.getRefreshToken(serverConnectionConfig.id)
        if (!refreshToken) {
          console.error('[nativeHttp] No refresh token available')
          throw new Error('No refresh token available')
        }

        // Attempt to refresh the token with retries for transient network errors
        let newTokens = null
        const MAX_REFRESH_RETRIES = 3
        for (let attempt = 1; attempt <= MAX_REFRESH_RETRIES; attempt++) {
          newTokens = await this.refreshAccessToken(refreshToken, serverConnectionConfig.address)
          if (newTokens?.accessToken) break
          if (attempt < MAX_REFRESH_RETRIES) {
            console.warn(`[nativeHttp] Token refresh attempt ${attempt} failed, retrying in ${attempt}s...`)
            await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
          }
        }
        if (!newTokens?.accessToken) {
          console.error('[nativeHttp] Failed to refresh access token after retries')
          throw new Error('Failed to refresh access token')
        }

        // Update the store with new tokens
        await this.updateTokens(newTokens, serverConnectionConfig)

        // Retry the original request with the new token
        console.log('[nativeHttp] Retrying original request with new token...')
        const retryResponse = await CapacitorHttp.request({
          method,
          url,
          data,
          headers: {
            ...headers,
            Authorization: `Bearer ${newTokens.accessToken}`
          },
          ...options
        })

        if (retryResponse.status >= 400) {
          console.error(`[nativeHttp] Retry request failed with status ${retryResponse.status}`)
          throw new Error(retryResponse.data)
        }

        return retryResponse.data
      } catch (error) {
        console.error('[nativeHttp] Token refresh failed:', error)

        // Only log the user out if the server explicitly rejected the refresh token (401/403).
        // For network errors, silently fail so the next request can retry automatically.
        const status = error?.status ?? error?.response?.status
        const isTokenRejected = status === 401 || status === 403
        await this.handleRefreshFailure(serverConnectionConfig?.id, isTokenRejected)
        throw error
      }
    },

    /**
     * Refreshes the access token using the refresh token
     * @param {string} refreshToken - The refresh token
     * @param {string} serverAddress - The server address
     * @returns {Promise<Object|null>} - Promise that resolves with new tokens or null
     */
    async refreshAccessToken(refreshToken, serverAddress) {
      try {
        if (!serverAddress) {
          throw new Error('No server address available')
        }

        console.log('[nativeHttp] Refreshing access token...')

        const response = await CapacitorHttp.post({
          url: `${serverAddress}/auth/refresh`,
          headers: {
            'Content-Type': 'application/json',
            'x-refresh-token': refreshToken
          },
          data: {}
        })

        if (response.status !== 200) {
          console.error('[nativeHttp] Token refresh request failed:', response.status)
          return null
        }

        const userResponseData = response.data
        if (!userResponseData.user?.accessToken) {
          console.error('[nativeHttp] No access token in refresh response')
          return null
        }

        console.log('[nativeHttp] Successfully refreshed access token')
        return {
          accessToken: userResponseData.user.accessToken,
          // Refresh token gets returned when refresh token is sent in x-refresh-token header
          refreshToken: userResponseData.user.refreshToken
        }
      } catch (error) {
        console.error('[nativeHttp] Failed to refresh access token:', error)
        return null
      }
    },

    /**
     * Updates the store and secure storage with new tokens
     * @param {Object} tokens - Object containing accessToken and refreshToken
     * @param {{ id: string, address: string, version: string }} serverConnectionConfig
     * @returns {Promise} - Promise that resolves when tokens are updated
     */
    async updateTokens(tokens, serverConnectionConfig) {
      try {
        if (!serverConnectionConfig?.id) {
          throw new Error('No server connection config ID available')
        }

        // Update the config with new tokens
        const preservedRefreshToken =
          tokens.refreshToken || serverConnectionConfig.refreshToken || (await $db.getRefreshToken(serverConnectionConfig.id))

        if (!preservedRefreshToken) {
          throw new Error('No refresh token available after refresh')
        }

        const updatedConfig = {
          ...serverConnectionConfig,
          token: tokens.accessToken,
          refreshToken: preservedRefreshToken
        }

        // Save updated config to secure storage, persists refresh token in secure storage
        const savedConfig = await $db.setServerConnectionConfig(updatedConfig)

        // Update the store
        store.commit('user/setAccessToken', tokens.accessToken)

        // Always re-authenticate socket after token refresh — the old token is no longer valid
        if ($socket?.connected) {
          $socket.sendAuthenticate()
        } else if (!$socket) {
          console.warn('[nativeHttp] Socket not available, cannot re-authenticate')
        }

        if (savedConfig) {
          store.commit('user/setServerConnectionConfig', savedConfig)
        }

        console.log('[nativeHttp] Successfully updated tokens in store and secure storage')
      } catch (error) {
        console.error('[nativeHttp] Failed to update tokens:', error)
        throw error
      }
    },

    /**
     * Handles the case when token refresh fails
     * @param {string} [serverConnectionConfigId]
     * @returns {Promise} - Promise that resolves when logout is complete
     */
    async handleRefreshFailure(serverConnectionConfigId, isTokenRejected = false) {
      try {
        if (!isTokenRejected) {
          // Network error during refresh — don't log out, the next request will retry
          console.warn('[nativeHttp] Token refresh failed due to network/server error, will retry on next request')
          return
        }

        console.log('[nativeHttp] Refresh token rejected by server - logging out user')

        // Clear store
        await store.dispatch('user/logout')

        if (serverConnectionConfigId) {
          // Clear refresh token for server connection config
          await $db.clearRefreshToken(serverConnectionConfigId)
        }

        // Redirect to login page
        if (typeof window !== 'undefined' && window.location.pathname !== '/connect') {
          const query = new URLSearchParams({ error: 'refreshTokenFailed' })
          if (serverConnectionConfigId) {
            query.set('serverConnectionConfigId', serverConnectionConfigId)
          }
          window.location.href = `/connect?${query.toString()}`
        }
      } catch (error) {
        console.error('[nativeHttp] Failed to handle refresh failure:', error)
      }
    },

    get(url, options = {}) {
      return this.request('GET', url, undefined, options)
    },
    post(url, data, options = {}) {
      return this.request('POST', url, data, options)
    },
    patch(url, data, options = {}) {
      return this.request('PATCH', url, data, options)
    },
    delete(url, options = {}) {
      return this.request('DELETE', url, undefined, options)
    }
  }
  inject('nativeHttp', nativeHttp)
}

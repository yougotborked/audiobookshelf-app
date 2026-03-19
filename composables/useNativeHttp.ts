import { CapacitorHttp } from '@capacitor/core'

interface RequestOptions {
  headers?: Record<string, string>
  serverConnectionConfig?: { id: string; address: string; token?: string; refreshToken?: string }
  [key: string]: unknown
}

interface HttpError extends Error {
  status?: number
  url?: string
  response?: { status?: number }
  code?: string
}

const getSafeLogUrl = (url = ''): string => {
  if (!url || typeof url !== 'string') return url
  const queryStart = url.indexOf('?')
  return queryStart === -1 ? url : url.slice(0, queryStart)
}

async function refreshAccessToken(refreshToken: string, serverAddress: string): Promise<{ accessToken: string; refreshToken?: string } | null> {
  try {
    const response = await CapacitorHttp.post({
      url: `${serverAddress}/auth/refresh`,
      headers: { 'Content-Type': 'application/json', 'x-refresh-token': refreshToken },
      data: {}
    })
    if (response.status !== 200) return null
    const userData = response.data as Record<string, unknown>
    const user = userData.user as Record<string, unknown>
    if (!user?.accessToken) return null
    return { accessToken: user.accessToken as string, refreshToken: user.refreshToken as string }
  } catch {
    return null
  }
}

async function handleRefreshFailure(serverConnectionConfigId: string | undefined, isTokenRejected: boolean): Promise<void> {
  if (!isTokenRejected) {
    console.warn('[nativeHttp] Token refresh failed due to network/server error, will retry on next request')
    return
  }
  console.log('[nativeHttp] Refresh token rejected by server - logging out user')
  const userStore = useUserStore()
  await userStore.logout()
  if (serverConnectionConfigId) {
    await useDb().clearRefreshToken(serverConnectionConfigId)
  }
  if (typeof window !== 'undefined' && window.location.pathname !== '/connect') {
    const query = new URLSearchParams({ error: 'refreshTokenFailed' })
    if (serverConnectionConfigId) query.set('serverConnectionConfigId', serverConnectionConfigId)
    window.location.href = `/connect?${query.toString()}`
  }
}

async function updateTokens(tokens: { accessToken: string; refreshToken?: string }, serverConnectionConfig: { id: string; address: string }): Promise<void> {
  const db = useDb()
  const preservedRefreshToken = tokens.refreshToken || await db.getRefreshToken(serverConnectionConfig.id)
  if (!preservedRefreshToken) throw new Error('No refresh token available after refresh')
  const updatedConfig = { ...serverConnectionConfig, token: tokens.accessToken, refreshToken: preservedRefreshToken }
  const savedConfig = await db.setServerConnectionConfig(updatedConfig as Record<string, unknown>)
  const userStore = useUserStore()
  userStore.accessToken = tokens.accessToken
  const socket = useSocket()
  if (socket?.connected) socket.sendAuthenticate()
  if (savedConfig) {
    userStore.serverConnectionConfig = savedConfig as import('~/types').ServerConnectionConfig
  }
}

async function handleTokenRefresh(
  method: string, url: string, data: unknown,
  headers: Record<string, string>, options: RequestOptions,
  serverConnectionConfig: { id: string; address: string }
): Promise<unknown> {
  try {
    const db = useDb()
    const refreshToken = await db.getRefreshToken(serverConnectionConfig.id)
    if (!refreshToken) throw new Error('No refresh token available')
    let newTokens = null
    const MAX_RETRIES = 3
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      newTokens = await refreshAccessToken(refreshToken, serverConnectionConfig.address)
      if (newTokens?.accessToken) break
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, attempt * 1000))
    }
    if (!newTokens?.accessToken) throw new Error('Failed to refresh access token')
    await updateTokens(newTokens, serverConnectionConfig)
    const retryResponse = await CapacitorHttp.request({
      method, url, data: data as Record<string, unknown>,
      headers: { ...headers, Authorization: `Bearer ${newTokens.accessToken}` },
      ...options
    })
    if (retryResponse.status >= 400) throw new Error(String(retryResponse.data))
    return retryResponse.data
  } catch (error) {
    const err = error as HttpError
    const status = err.status ?? err.response?.status
    const isTokenRejected = status === 401 || status === 403
    await handleRefreshFailure(serverConnectionConfig?.id, isTokenRejected)
    throw error
  }
}

async function request(method: string, _url: string, data: unknown, options: RequestOptions = {}): Promise<unknown> {
  const serverConnectionConfig = options.serverConnectionConfig || useUserStore().serverConnectionConfig
  delete options.serverConnectionConfig

  let url = _url
  let headers: Record<string, string> = {}
  if (!url.startsWith('http') && !url.startsWith('capacitor')) {
    const bearerToken = useUserStore().accessToken
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`
    } else {
      console.warn('[nativeHttp] No Bearer Token for request')
    }
    if (serverConnectionConfig?.address) {
      url = `${serverConnectionConfig.address}${url}`
    }
  }
  if (data) headers['Content-Type'] = 'application/json'
  if (options.headers) {
    headers = { ...headers, ...options.headers }
    delete options.headers
  }
  console.log(`[nativeHttp] Making ${method} request to ${getSafeLogUrl(url)}`)

  try {
    const res = await CapacitorHttp.request({ method, url, data: data as Record<string, unknown>, headers, ...options })
    const appStore = useAppStore()
    appStore.serverReachable = true
    if (res.status === 401 && serverConnectionConfig) {
      return handleTokenRefresh(method, url, data, headers, options, serverConnectionConfig as { id: string; address: string })
    }
    if (res.status >= 400) {
      const error: HttpError = new Error(String(res.data))
      error.status = res.status
      error.url = url
      throw error
    }
    return res.data
  } catch (error) {
    const err = error as HttpError
    const status = err.status ?? err.response?.status
    const errorCode = (err.code || '').toString().toUpperCase()
    const message = (err.message || '').toLowerCase()
    const isLikelyNetworkError =
      status === 0 ||
      ['ERR_NETWORK', 'ECONNABORTED', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(errorCode) ||
      message.includes('network') || message.includes('connection') ||
      message.includes('timed out') || message.includes('offline')
    const appStore = useAppStore()
    if (typeof status === 'number' && status >= 400 && !isLikelyNetworkError) {
      appStore.serverReachable = true
    } else if (isLikelyNetworkError) {
      appStore.serverReachable = false
    }
    throw error
  }
}

const _nativeHttp = {
  get: (url: string, options?: RequestOptions) => request('GET', url, undefined, options),
  post: (url: string, data: unknown, options?: RequestOptions) => request('POST', url, data, options),
  patch: (url: string, data: unknown, options?: RequestOptions) => request('PATCH', url, data, options),
  delete: (url: string, options?: RequestOptions) => request('DELETE', url, undefined, options)
}

export function useNativeHttp() {
  return _nativeHttp
}

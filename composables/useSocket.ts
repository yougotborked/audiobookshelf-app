// Module-level singleton so Pinia stores can access socket without useNuxtApp()

export interface ServerSocketInterface {
  connected: boolean
  isAuthenticated?: boolean
  logout(): void
  sendAuthenticate(): void
  [key: string]: unknown
}

let _socket: ServerSocketInterface | null = null

export function setSocket(socket: ServerSocketInterface): void {
  _socket = socket
}

export function useSocket(): ServerSocketInterface {
  if (!_socket) {
    // Return a no-op proxy if socket not yet initialized (e.g. during SSR stub)
    return {
      connected: false,
      logout() { console.warn('[useSocket] Socket not initialized') },
      sendAuthenticate() { console.warn('[useSocket] Socket not initialized') }
    }
  }
  return _socket
}

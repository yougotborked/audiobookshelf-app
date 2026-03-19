// Module-level singleton so Pinia stores can access socket without useNuxtApp()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCallback = (...args: any[]) => void

export interface ServerSocketInterface {
  connected: boolean
  isAuthenticated?: boolean
  logout(): void
  sendAuthenticate(): void
  on(event: string, callback: AnyCallback): this
  off(event: string, callback: AnyCallback): this
  $on(event: string, callback: AnyCallback): void
  $off(event: string, callback: AnyCallback): void
  connect(serverAddress: string, token: string): void
}

const noOp = () => { console.warn('[useSocket] Socket not initialized') }

const _noOpSocket: ServerSocketInterface = {
  connected: false,
  logout: noOp,
  sendAuthenticate: noOp,
  on(_event: string, _callback: AnyCallback) { noOp(); return this },
  off(_event: string, _callback: AnyCallback) { noOp(); return this },
  $on: noOp,
  $off: noOp,
  connect: noOp,
}

let _socket: ServerSocketInterface | null = null

export function setSocket(socket: ServerSocketInterface): void {
  _socket = socket
}

export function useSocket(): ServerSocketInterface {
  return _socket ?? _noOpSocket
}

import { Capacitor } from '@capacitor/core'

export function usePlatform(): string {
  return Capacitor.getPlatform()
}

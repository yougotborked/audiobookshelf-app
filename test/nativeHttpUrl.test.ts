import { describe, expect, it } from 'vitest'
import { resolveRequestUrl } from '~/composables/useNativeHttp'

describe('resolveRequestUrl', () => {
  it('refuses an API path when there is no server yet', () => {
    // The bug: sent anyway, it resolved against the app's own origin, which answers every
    // unknown path with index.html - and the stats page received "<!DOCTYPE html>…" as data.
    expect(resolveRequestUrl('/api/me/listening-stats', undefined)).toBeNull()
    expect(resolveRequestUrl('/api/me/listening-stats', null)).toBeNull()
    expect(resolveRequestUrl('/api/me/listening-stats', '')).toBeNull()
  })

  it('puts the server in front of an API path once there is one', () => {
    expect(resolveRequestUrl('/api/me', 'https://abs.example')).toBe('https://abs.example/api/me')
  })

  it('does not double the slash when the address ends with one', () => {
    expect(resolveRequestUrl('/api/me', 'https://abs.example/')).toBe('https://abs.example/api/me')
  })

  it('adds the slash when the path lacks one', () => {
    expect(resolveRequestUrl('api/me', 'https://abs.example')).toBe('https://abs.example/api/me')
  })

  it('leaves absolute URLs alone, with or without a server', () => {
    expect(resolveRequestUrl('https://other.example/x', undefined)).toBe('https://other.example/x')
    expect(resolveRequestUrl('https://other.example/x', 'https://abs.example')).toBe('https://other.example/x')
    expect(resolveRequestUrl('capacitor://localhost/_capacitor_file_/a', undefined)).toBe('capacitor://localhost/_capacitor_file_/a')
  })
})

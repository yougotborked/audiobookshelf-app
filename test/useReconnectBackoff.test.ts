import { describe, expect, it } from 'vitest'
import { RECONNECT_BACKOFF_MS, reconnectDelayMs } from '~/composables/useReconnectBackoff'

// The bug this guards: the reconnect loop retried every 2s then every 5s forever, so driving
// through patchy coverage kept the app busy failing for the whole journey.
describe('reconnectDelayMs', () => {
  it('starts with the shortest delay', () => {
    expect(reconnectDelayMs(0)).toBe(RECONNECT_BACKOFF_MS[0])
  })

  it('backs off across attempts', () => {
    const delays = RECONNECT_BACKOFF_MS.map((_, index) => reconnectDelayMs(index))
    expect(delays).toEqual(RECONNECT_BACKOFF_MS)
  })

  it('increases monotonically', () => {
    for (let i = 1; i < RECONNECT_BACKOFF_MS.length; i += 1) {
      expect(reconnectDelayMs(i)).toBeGreaterThan(reconnectDelayMs(i - 1))
    }
  })

  it('holds at the longest delay instead of growing without bound', () => {
    const longest = RECONNECT_BACKOFF_MS[RECONNECT_BACKOFF_MS.length - 1]
    expect(reconnectDelayMs(RECONNECT_BACKOFF_MS.length)).toBe(longest)
    expect(reconnectDelayMs(10_000)).toBe(longest)
  })

  it('clamps malformed input to the shortest delay rather than stranding the app offline', () => {
    expect(reconnectDelayMs(-1)).toBe(RECONNECT_BACKOFF_MS[0])
    expect(reconnectDelayMs(Number.NaN)).toBe(RECONNECT_BACKOFF_MS[0])
    expect(reconnectDelayMs(Number.POSITIVE_INFINITY)).toBe(RECONNECT_BACKOFF_MS[0])
  })

  it('never returns a delay long enough to look like a hang', () => {
    expect(Math.max(...RECONNECT_BACKOFF_MS)).toBeLessThanOrEqual(60_000)
  })
})

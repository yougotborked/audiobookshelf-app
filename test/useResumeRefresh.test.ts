import { describe, expect, it } from 'vitest'
import { RESUME_STALE_AFTER_MS, isResumeStale, shouldCheckServerOnResume } from '~/composables/useResumeRefresh'

// The bug this guards: after an hour backgrounded, the webview's copy of the user's media
// progress was an hour old, so Catch up offered a finished episode from where it stood before
// the screen went off. Local progress was reloaded on resume; the server's copy was not.
describe('isResumeStale', () => {
  it('treats a long time away as stale', () => {
    expect(isResumeStale(60 * 60 * 1000)).toBe(true)
    expect(isResumeStale(RESUME_STALE_AFTER_MS + 1)).toBe(true)
  })

  it('does not treat flipping away and back as stale', () => {
    expect(isResumeStale(0)).toBe(false)
    expect(isResumeStale(1500)).toBe(false)
    expect(isResumeStale(RESUME_STALE_AFTER_MS)).toBe(false)
  })

  it('treats a missing or malformed elapsed time as stale', () => {
    // Better to re-read than to keep an hour-old position on a bad clock reading.
    expect(isResumeStale(Number.NaN)).toBe(true)
    expect(isResumeStale(Number.POSITIVE_INFINITY)).toBe(true)
  })
})

describe('shouldCheckServerOnResume', () => {
  const online = {
    elapsedMs: 60 * 60 * 1000,
    offlineModeEnabled: false,
    networkConnected: true,
    hasServerConnectionConfig: true
  }

  it('checks the server after a long time away', () => {
    expect(shouldCheckServerOnResume(online)).toBe(true)
  })

  it('does not check after a brief switch away', () => {
    expect(shouldCheckServerOnResume({ ...online, elapsedMs: 2000 })).toBe(false)
  })

  it('never overrides offline mode', () => {
    expect(shouldCheckServerOnResume({ ...online, offlineModeEnabled: true })).toBe(false)
  })

  it('does not reach out with no connection', () => {
    expect(shouldCheckServerOnResume({ ...online, networkConnected: false })).toBe(false)
  })

  it('does not reach out with no server configured', () => {
    expect(shouldCheckServerOnResume({ ...online, hasServerConnectionConfig: false })).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { describePodcastIndexFailure } from '~/composables/usePodcastIndex'

// The bug this came from: discovery never loaded, and every failure path returned an empty
// array, so a rejected request looked exactly like "nothing is trending". The actual cause was
// that browser fetch() silently drops the User-Agent header - it is a forbidden header name -
// and Podcast Index answers a request without one with 400. Verified against the live API:
// with a proper User-Agent the same request reaches auth and returns 401; without, 400.
describe('describePodcastIndexFailure', () => {
  it('treats a missing or unacceptable User-Agent as a rejection', () => {
    // Podcast Index uses 400 for this, and it is this app's fault, not the user's.
    expect(describePodcastIndexFailure(400)).toBe('rejected')
  })

  it('treats bad credentials as a rejection', () => {
    expect(describePodcastIndexFailure(401)).toBe('rejected')
    expect(describePodcastIndexFailure(403)).toBe('rejected')
  })

  it('calls out rate limiting separately, because waiting fixes it', () => {
    expect(describePodcastIndexFailure(429)).toBe('rate-limited')
  })

  it('separates their outage from our mistake', () => {
    expect(describePodcastIndexFailure(500)).toBe('server-error')
    expect(describePodcastIndexFailure(502)).toBe('server-error')
    expect(describePodcastIndexFailure(503)).toBe('server-error')
  })

  it('falls back to a rejection for anything unrecognised', () => {
    expect(describePodcastIndexFailure(404)).toBe('rejected')
    expect(describePodcastIndexFailure(418)).toBe('rejected')
  })
})

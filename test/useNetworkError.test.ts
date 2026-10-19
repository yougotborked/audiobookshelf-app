import { describe, expect, it } from 'vitest'
import { isTransportFailure } from '~/composables/useNetworkError'

// The bug this guards: reachability used to be decided by searching the error text for words
// like "network" and "timed out". The strings Android actually throws contain none of them, so
// a phone on wifi with no working internet — a plane, a captive portal — was treated as having
// a reachable server.
describe('isTransportFailure', () => {
  it('counts a request that never got a status as a transport failure', () => {
    expect(isTransportFailure({ message: 'Unable to resolve host "abs.example.com"' })).toBe(true)
    expect(isTransportFailure({ message: 'failed to connect to /10.0.0.4 after 6000ms' })).toBe(true)
    expect(isTransportFailure({ message: 'No route to host' })).toBe(true)
  })

  it('does not count a server error as a transport failure', () => {
    expect(isTransportFailure({ status: 500 })).toBe(false)
  })

  it('does not count an auth failure as a transport failure', () => {
    expect(isTransportFailure({ status: 401 })).toBe(false)
  })

  it('reads the status off a nested response', () => {
    expect(isTransportFailure({ response: { status: 404 } })).toBe(false)
  })

  it('counts a zero status as a transport failure', () => {
    // 0 is what a cancelled or blocked request reports; the server did not answer.
    expect(isTransportFailure({ status: 0 })).toBe(true)
  })

  it('counts a missing error object as a transport failure', () => {
    expect(isTransportFailure(null)).toBe(true)
    expect(isTransportFailure(undefined)).toBe(true)
  })
})

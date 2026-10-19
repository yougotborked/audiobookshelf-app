import { describe, expect, it } from 'vitest'
import { FINISHED_PROGRESS_THRESHOLD, isProgressFinished } from '~/composables/useMediaProgress'

// The bug this guards: the app had three definitions of "finished", so one episode could read
// "Finished" on one screen, "19 sec left" on another, and still sit in Catch up waiting to be
// played. Every surface now asks this function.
describe('isProgressFinished', () => {
  it('treats the stored flag as finished', () => {
    expect(isProgressFinished({ isFinished: true })).toBe(true)
  })

  it('treats the stored flag as finished even when progress disagrees', () => {
    expect(isProgressFinished({ isFinished: true, progress: 0.2 })).toBe(true)
  })

  it('treats progress at the threshold as finished', () => {
    expect(isProgressFinished({ progress: FINISHED_PROGRESS_THRESHOLD })).toBe(true)
  })

  it('does not treat progress just under the threshold as finished', () => {
    expect(isProgressFinished({ progress: FINISHED_PROGRESS_THRESHOLD - 0.001 })).toBe(false)
  })

  it('does not treat an episode most of the way through as finished', () => {
    expect(isProgressFinished({ progress: 0.97 })).toBe(false)
  })

  it('reports not finished for a missing record', () => {
    expect(isProgressFinished(null)).toBe(false)
    expect(isProgressFinished(undefined)).toBe(false)
  })

  it('reports not finished for an empty record', () => {
    expect(isProgressFinished({})).toBe(false)
  })

  it('ignores a non-numeric progress value', () => {
    expect(isProgressFinished({ progress: '1' as unknown as number })).toBe(false)
  })

  // The native layer writes isFinished using the same threshold. If these ever diverge, what
  // the app shows and what it stores stop agreeing — which is the original bug.
  it('matches the threshold the native layer writes', () => {
    expect(FINISHED_PROGRESS_THRESHOLD).toBe(0.99)
  })
})

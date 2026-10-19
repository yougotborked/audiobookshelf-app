import { describe, expect, it } from 'vitest'
import { useUtils } from '~/composables/useUtils'

const { secondsToTimestamp, secondsToTimestampFull } = useUtils()

// The bug this guards: items marked played showed "-1 sec left". A negative or NaN duration ran
// through the arithmetic unchecked and came out as a plausible-looking timestamp —
// secondsToTimestamp(-0.001) rendered "-1:59:59" rather than anything obviously wrong.
describe('secondsToTimestamp', () => {
  it('formats under an hour without an hours field', () => {
    expect(secondsToTimestamp(0)).toBe('0:00')
    expect(secondsToTimestamp(9)).toBe('0:09')
    expect(secondsToTimestamp(75)).toBe('1:15')
    expect(secondsToTimestamp(3599)).toBe('59:59')
  })

  it('formats an hour and over with an hours field', () => {
    expect(secondsToTimestamp(3600)).toBe('1:00:00')
    expect(secondsToTimestamp(3661)).toBe('1:01:01')
  })

  it('truncates fractional seconds rather than rounding past the end', () => {
    expect(secondsToTimestamp(59.9)).toBe('0:59')
  })

  it('clamps a negative duration to zero', () => {
    expect(secondsToTimestamp(-0.001)).toBe('0:00')
    expect(secondsToTimestamp(-1)).toBe('0:00')
    expect(secondsToTimestamp(-3600)).toBe('0:00')
  })

  it('clamps a malformed duration to zero', () => {
    expect(secondsToTimestamp(Number.NaN)).toBe('0:00')
    expect(secondsToTimestamp(undefined as unknown as number)).toBe('0:00')
    expect(secondsToTimestamp(null as unknown as number)).toBe('0:00')
  })

  it('never renders a negative sign', () => {
    for (const seconds of [-0.001, -1, -59, -60, -3601, Number.NEGATIVE_INFINITY]) {
      expect(secondsToTimestamp(seconds)).not.toContain('-')
    }
  })
})

describe('secondsToTimestampFull', () => {
  it('always pads to hours:minutes:seconds', () => {
    expect(secondsToTimestampFull(0)).toBe('00:00:00')
    expect(secondsToTimestampFull(9)).toBe('00:00:09')
    expect(secondsToTimestampFull(3661)).toBe('01:01:01')
  })

  it('clamps negative and malformed durations to zero', () => {
    expect(secondsToTimestampFull(-1)).toBe('00:00:00')
    expect(secondsToTimestampFull(Number.NaN)).toBe('00:00:00')
  })

  it('never renders a negative sign', () => {
    for (const seconds of [-0.001, -1, -3601, Number.NEGATIVE_INFINITY]) {
      expect(secondsToTimestampFull(seconds)).not.toContain('-')
    }
  })
})

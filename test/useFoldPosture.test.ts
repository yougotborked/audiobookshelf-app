import { describe, expect, it } from 'vitest'
import {
  FLAT,
  MIN_PANE_FRACTION,
  hingeSplit,
  parseFoldState,
  shouldSplitAtHinge,
  type FoldState
} from '~/composables/useFoldPosture'

const tabletop = (hingeFraction: number, hingeThicknessFraction = 0): FoldState => ({
  posture: 'tabletop',
  hingeFraction,
  hingeThicknessFraction
})

describe('parseFoldState', () => {
  it('reads a posture the native side sent', () => {
    expect(parseFoldState({ posture: 'tabletop', hingeFraction: 0.5, hingeThicknessFraction: 0 })).toEqual(
      tabletop(0.5)
    )
    expect(parseFoldState({ posture: 'book', hingeFraction: 0.5, hingeThicknessFraction: 0.01 })).toEqual({
      posture: 'book',
      hingeFraction: 0.5,
      hingeThicknessFraction: 0.01
    })
  })

  // Everything that crosses the bridge badly should lay out as a flat device, not throw and not
  // half-apply: an older build, a plugin that did not load, the web fallback.
  it('falls back to flat for anything it does not recognise', () => {
    expect(parseFoldState(undefined)).toEqual(FLAT)
    expect(parseFoldState(null)).toEqual(FLAT)
    expect(parseFoldState('tabletop')).toEqual(FLAT)
    expect(parseFoldState({})).toEqual(FLAT)
    expect(parseFoldState({ posture: 'flat', hingeFraction: 0, hingeThicknessFraction: 0 })).toEqual(FLAT)
    expect(parseFoldState({ posture: 'sideways', hingeFraction: 0.5 })).toEqual(FLAT)
    expect(parseFoldState({ posture: 'tabletop', hingeFraction: 'half' })).toEqual(FLAT)
    expect(parseFoldState({ posture: 'tabletop', hingeFraction: NaN })).toEqual(FLAT)
  })

  it('clamps fractions into range and treats a missing thickness as seamless', () => {
    expect(parseFoldState({ posture: 'tabletop', hingeFraction: 1.4 }).hingeFraction).toBe(1)
    expect(parseFoldState({ posture: 'tabletop', hingeFraction: -0.2 }).hingeFraction).toBe(0)
    expect(parseFoldState({ posture: 'tabletop', hingeFraction: 0.5 }).hingeThicknessFraction).toBe(0)
  })
})

describe('shouldSplitAtHinge', () => {
  it('splits a tabletop hinge near the middle', () => {
    expect(shouldSplitAtHinge(tabletop(0.5))).toBe(true)
    expect(shouldSplitAtHinge(tabletop(0.45))).toBe(true)
  })

  it('does not split a flat device', () => {
    expect(shouldSplitAtHinge(FLAT)).toBe(false)
  })

  // Book posture puts the halves side by side. The player has nothing for a second column, so a
  // split there is empty space with a seam down it.
  it('does not split in book posture', () => {
    expect(shouldSplitAtHinge({ posture: 'book', hingeFraction: 0.5, hingeThicknessFraction: 0 })).toBe(false)
  })

  // A sliver fits neither the artwork nor the controls.
  it('does not split when either pane would be too small', () => {
    expect(shouldSplitAtHinge(tabletop(0.1))).toBe(false)
    expect(shouldSplitAtHinge(tabletop(0.9))).toBe(false)
    expect(shouldSplitAtHinge(tabletop(MIN_PANE_FRACTION - 0.01))).toBe(false)
    expect(shouldSplitAtHinge(tabletop(MIN_PANE_FRACTION))).toBe(true)
  })

  it('counts hinge thickness against the panes', () => {
    // Panes of exactly MIN_PANE_FRACTION either side of a fat hinge still qualify...
    expect(shouldSplitAtHinge(tabletop(0.5, 0.4))).toBe(true)
    // ...but one unit more of hinge and the top pane drops under it.
    expect(shouldSplitAtHinge(tabletop(0.5, 0.42))).toBe(false)
  })
})

describe('hingeSplit', () => {
  it('gives the panes either side of a seamless central hinge', () => {
    expect(hingeSplit(tabletop(0.5))).toEqual({ topPercent: 50, hingePercent: 0, bottomPercent: 50 })
  })

  it('reserves the hinge itself when it has thickness', () => {
    expect(hingeSplit(tabletop(0.5, 0.04))).toEqual({
      topPercent: 48,
      hingePercent: 4,
      bottomPercent: 48
    })
  })

  it('is null whenever the screen should not be split', () => {
    expect(hingeSplit(FLAT)).toBeNull()
    expect(hingeSplit(tabletop(0.1))).toBeNull()
  })
})

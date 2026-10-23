import { describe, expect, it } from 'vitest'
import { ORIENTATION_LOCK_IGNORED_FROM_DP, isOrientationLockHonored } from '~/composables/useOrientationLock'

// Targeting SDK 36 means Android ignores orientation restrictions at 600dp and above, so the
// setting silently stops working on a large foldable's inner screen.
describe('isOrientationLockHonored', () => {
  it('is honored on a phone', () => {
    expect(isOrientationLockHonored(412)).toBe(true)
    expect(isOrientationLockHonored(360)).toBe(true)
  })

  it('is honored on a foldable cover screen', () => {
    // Narrow outer displays stay under the threshold.
    expect(isOrientationLockHonored(404)).toBe(true)
  })

  it('is ignored from the threshold up', () => {
    expect(isOrientationLockHonored(ORIENTATION_LOCK_IGNORED_FROM_DP)).toBe(false)
    expect(isOrientationLockHonored(673)).toBe(false) // a large foldable, unfolded
    expect(isOrientationLockHonored(1280)).toBe(false)
  })

  it('stays honored just below the threshold', () => {
    expect(isOrientationLockHonored(ORIENTATION_LOCK_IGNORED_FROM_DP - 1)).toBe(true)
  })

  it('assumes it works when the window cannot be measured', () => {
    // Offering a control that turns out not to apply beats hiding one that would have worked.
    expect(isOrientationLockHonored(0)).toBe(true)
    expect(isOrientationLockHonored(Number.NaN)).toBe(true)
    expect(isOrientationLockHonored(-1)).toBe(true)
  })
})

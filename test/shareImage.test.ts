import { describe, expect, it } from 'vitest'
import { isShareCancellation } from '~/composables/useShareImage'

describe('isShareCancellation', () => {
  // The string is not ours and it changed when the plugin did: the abandoned filesharer threw
  // 'USER_CANCELLED', @capacitor/share throws 'Share canceled'. Treating a cancellation as a
  // failure shows an error toast to someone who simply decided not to share - harmless enough
  // that it would never get reported, and wrong for months.
  it('recognises the wording the old plugin used, so nothing regresses mid-upgrade', () => {
    expect(isShareCancellation('USER_CANCELLED')).toBe(true)
  })

  it('recognises what @capacitor/share actually throws', () => {
    expect(isShareCancellation('Share canceled')).toBe(true)
  })

  it('accepts both spellings of cancelled', () => {
    // One l is the American spelling the plugin uses; two is what a platform message might.
    expect(isShareCancellation('Share cancelled')).toBe(true)
    expect(isShareCancellation('Share canceled')).toBe(true)
  })

  it('ignores case and surrounding whitespace', () => {
    expect(isShareCancellation('  share CANCELED  ')).toBe(true)
  })

  it('does not swallow a real failure', () => {
    // The point of the function. If these read as cancellations the user is told nothing at all
    // when sharing genuinely breaks.
    expect(isShareCancellation('No Activity found to handle Intent')).toBe(false)
    expect(isShareCancellation('Not a base64 data URL')).toBe(false)
    expect(isShareCancellation('EACCES: permission denied')).toBe(false)
    expect(isShareCancellation('')).toBe(false)
  })
})

import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * Sharing a rendered PNG, in one place rather than three.
 *
 * This replaces @webnativellc/capacitor-filesharer, which never shipped a Capacitor 8 release
 * and was the last thing pinning the project to 7.x. Its own build file also still called the
 * proguard default that AGP 9 removed, which is why dropping it is what lets
 * android.r8.proguardAndroidTxt.disallowed come out of gradle.properties.
 *
 * The official replacement is two plugins rather than one: Filesystem writes the bytes and
 * Share hands off the resulting URI. Cache rather than Documents, because a share sheet only
 * needs the file to outlive the handoff - these are regenerated on demand and should not
 * accumulate in a user-visible folder.
 */
export async function shareImage(dataUrl: string, filename: string): Promise<void> {
  const base64Data = dataUrl.split(';base64,').pop()
  if (!base64Data) throw new Error('Not a base64 data URL')

  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Cache
  })
  await Share.share({ files: [uri] })
}

/**
 * Whether a failure was the person closing the share sheet.
 *
 * Worth a named function because the string is not ours and it changed with the plugin: the old
 * one threw 'USER_CANCELLED', @capacitor/share throws 'Share canceled' - one l, and only on
 * some platforms. Getting this wrong does not break sharing, it just shows an error toast to
 * someone who decided not to share, which is the kind of thing that survives for months because
 * nobody files it.
 */
export function isShareCancellation(message: string): boolean {
  const normalised = message.trim().toLowerCase()
  return (
    normalised === 'user_cancelled' ||
    normalised === 'share canceled' ||
    normalised === 'share cancelled' ||
    normalised === 'abort' ||
    normalised.includes('canceled') ||
    normalised.includes('cancelled')
  )
}

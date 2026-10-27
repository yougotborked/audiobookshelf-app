import { describe, expect, it } from 'vitest'
import { buildLocalCoverMap, resolveCoverSrc } from '~/composables/useCoverSource'

// The bug this guards: minimal mode asked only the server for its cover, so with the server
// offline it showed the Podshelf mark while the real artwork sat in the download folder.

describe('buildLocalCoverMap', () => {
  it('keys downloads by the server id the episodes carry', () => {
    expect(buildLocalCoverMap([{ id: 'local-1', libraryItemId: 'li-1', coverContentUrl: '/files/a.jpg' }])).toEqual({ 'li-1': '/files/a.jpg' })
  })

  it('skips a download with no cover on disk', () => {
    expect(buildLocalCoverMap([{ id: 'local-1', libraryItemId: 'li-1' }])).toEqual({})
  })

  it('skips a download that is not linked to a server item', () => {
    // Nothing could look it up, so an entry would only ever be dead weight
    expect(buildLocalCoverMap([{ id: 'local-1', coverContentUrl: '/files/a.jpg' }])).toEqual({})
  })

  it('survives an empty or holey list', () => {
    expect(buildLocalCoverMap()).toEqual({})
    expect(buildLocalCoverMap([null as never, { libraryItemId: 'li-1', coverContentUrl: '/f.jpg' }])).toEqual({ 'li-1': '/f.jpg' })
  })
})

describe('resolveCoverSrc', () => {
  it('uses the downloaded file, converted for the webview', () => {
    expect(resolveCoverSrc({ localCoverUrl: '/files/a.jpg', toFileUrl: (p) => `capacitor://${p}` })).toBe('capacitor:///files/a.jpg')
  })

  it('prefers the downloaded file even when the server is reachable', () => {
    // The file is already there; fetching the same image over the network buys nothing
    expect(resolveCoverSrc({ localCoverUrl: '/files/a.jpg', serverCoverSrc: 'https://abs/cover' })).toBe('/files/a.jpg')
  })

  it('falls back to the server when nothing is downloaded', () => {
    expect(resolveCoverSrc({ serverCoverSrc: 'https://abs/cover' })).toBe('https://abs/cover')
  })

  it('is null when neither exists, so a placeholder can take over', () => {
    expect(resolveCoverSrc({})).toBeNull()
    expect(resolveCoverSrc()).toBeNull()
    expect(resolveCoverSrc({ serverCoverSrc: '' })).toBeNull()
  })

  it('does not run the file conversion on a server URL', () => {
    expect(resolveCoverSrc({ serverCoverSrc: 'https://abs/cover', toFileUrl: () => 'WRONG' })).toBe('https://abs/cover')
  })
})

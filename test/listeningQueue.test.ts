import { describe, expect, it } from 'vitest'
import { episodeProgress, episodePublishedAt, isEpisodeFinished, isEpisodeStarted, orderListeningQueue, queueItemStartTime, toPlayQueueItems, type ListeningEpisode, type ProgressLookup } from '~/composables/useListeningQueue'

// The rules these cover used to live in a computed property inside PodcastCatchUpFeed.vue, where
// the only way to check "what plays next" was to open the app and look at the list. Minimal mode
// asks the same question with no list on screen, so the answer has to be checkable here.

const DAY = 24 * 60 * 60 * 1000

function episode(id: string, publishedAt: number, extra: Partial<ListeningEpisode> = {}): ListeningEpisode {
  return { id, libraryItemId: `show-${id.split('-')[0]}`, publishedAt, ...extra }
}

describe('episodePublishedAt', () => {
  it('reads millisecond timestamps as they are', () => {
    expect(episodePublishedAt({ publishedAt: 1700000000000 })).toBe(1700000000000)
  })

  it('promotes second timestamps to milliseconds', () => {
    // A feed reporting seconds alongside one reporting milliseconds would otherwise look like
    // 1970 and sort its whole back catalogue to the front of the queue
    expect(episodePublishedAt({ publishedAt: 1700000000 })).toBe(1700000000000)
  })

  it('reads a numeric string', () => {
    expect(episodePublishedAt({ publishedAt: '1700000000000' })).toBe(1700000000000)
  })

  it('falls back to pubDate when publishedAt is absent', () => {
    expect(episodePublishedAt({ pubDate: 'Tue, 14 Nov 2023 22:13:20 GMT' })).toBe(1700000000000)
  })

  it('prefers publishedAt over pubDate', () => {
    expect(episodePublishedAt({ publishedAt: 1700000000000, pubDate: 'Thu, 01 Jan 1970 00:00:00 GMT' })).toBe(1700000000000)
  })

  it('treats a publishedAt of 0 as absent rather than as 1970', () => {
    expect(episodePublishedAt({ publishedAt: 0, pubDate: 'Tue, 14 Nov 2023 22:13:20 GMT' })).toBe(1700000000000)
  })

  it('returns 0 for nothing usable', () => {
    expect(episodePublishedAt({})).toBe(0)
    expect(episodePublishedAt({ pubDate: 'not a date' })).toBe(0)
    expect(episodePublishedAt({ publishedAt: Number.POSITIVE_INFINITY })).toBe(0)
    expect(episodePublishedAt(null)).toBe(0)
  })
})

describe('episodeProgress', () => {
  const lookup: ProgressLookup = {
    server: () => ({ currentTime: 10, lastUpdate: 100 }),
    local: () => ({ currentTime: 250, lastUpdate: 500 })
  }

  it('prefers the most recently updated source field by field', () => {
    const merged = episodeProgress(episode('a-1', DAY), lookup)
    expect(merged?.currentTime).toBe(250)
    expect(merged?.lastUpdate).toBe(500)
  })

  it('treats finished in any source as finished, however stale', () => {
    // The device sets isFinished the moment playback ends; the server record it will overwrite
    // still says otherwise, and must not put the episode back in the queue
    const merged = episodeProgress(episode('a-1', DAY), {
      server: () => ({ isFinished: false, lastUpdate: 900 }),
      local: () => ({ isFinished: true, lastUpdate: 100 })
    })
    expect(merged?.isFinished).toBe(true)
  })

  it('uses progress carried on the episode when there is no lookup', () => {
    expect(episodeProgress(episode('a-1', DAY, { progress: { currentTime: 7 } }))?.currentTime).toBe(7)
  })

  it('is null when nothing knows anything', () => {
    expect(episodeProgress(episode('a-1', DAY))).toBeNull()
  })

  it('does not consult the lookups for an episode with no ids', () => {
    let asked = false
    episodeProgress(
      { publishedAt: DAY },
      {
        server: () => {
          asked = true
          return null
        }
      }
    )
    expect(asked).toBe(false)
  })
})

describe('isEpisodeFinished', () => {
  it('is true for the stored flag', () => {
    expect(isEpisodeFinished(episode('a-1', DAY, { progress: { isFinished: true } }))).toBe(true)
  })

  it('is true at the shared threshold, not only at exactly 1', () => {
    expect(isEpisodeFinished(episode('a-1', DAY, { progress: { progress: 0.995 } }))).toBe(true)
    expect(isEpisodeFinished(episode('a-1', DAY, { progress: { progress: 0.5 } }))).toBe(false)
  })

  it('reads the server and the device, not just what came with the episode', () => {
    const ep = episode('a-1', DAY)
    expect(isEpisodeFinished(ep, { server: () => ({ isFinished: true }) })).toBe(true)
    expect(isEpisodeFinished(ep, { local: () => ({ isFinished: true }) })).toBe(true)
  })
})

describe('isEpisodeStarted', () => {
  it('is true partway through', () => {
    expect(isEpisodeStarted(episode('a-1', DAY, { progress: { currentTime: 90 } }))).toBe(true)
  })

  it('is false for an episode never opened', () => {
    expect(isEpisodeStarted(episode('a-1', DAY))).toBe(false)
    expect(isEpisodeStarted(episode('a-1', DAY, { progress: { currentTime: 0 } }))).toBe(false)
  })

  it('is false once finished, so it is not both started and over', () => {
    expect(isEpisodeStarted(episode('a-1', DAY, { progress: { currentTime: 900, isFinished: true } }))).toBe(false)
  })
})

describe('orderListeningQueue', () => {
  it('drops finished episodes', () => {
    const queue = orderListeningQueue([episode('a-1', 1 * DAY, { progress: { isFinished: true } }), episode('a-2', 2 * DAY)])
    expect(queue.map((ep) => ep.id)).toEqual(['a-2'])
  })

  it('orders oldest first', () => {
    const queue = orderListeningQueue([episode('a-3', 3 * DAY), episode('a-1', 1 * DAY), episode('a-2', 2 * DAY)])
    expect(queue.map((ep) => ep.id)).toEqual(['a-1', 'a-2', 'a-3'])
  })

  it('honours an excluded show', () => {
    const queue = orderListeningQueue([episode('a-1', 1 * DAY), episode('b-1', 2 * DAY)], { rules: { 'show-a': { mode: 'exclude' } } })
    expect(queue.map((ep) => ep.id)).toEqual(['b-1'])
  })

  it('caps a newest-N show to its newest remaining episodes', () => {
    const queue = orderListeningQueue([episode('a-1', 1 * DAY), episode('a-2', 2 * DAY), episode('a-3', 3 * DAY)], { rules: { 'show-a': { mode: 'latest', limit: 2 } } })
    expect(queue.map((ep) => ep.id)).toEqual(['a-2', 'a-3'])
  })

  it('applies newest-N after dropping finished, so a played episode does not use up the allowance', () => {
    const queue = orderListeningQueue([episode('a-1', 1 * DAY), episode('a-2', 2 * DAY), episode('a-3', 3 * DAY, { progress: { isFinished: true } })], { rules: { 'show-a': { mode: 'latest', limit: 2 } } })
    expect(queue.map((ep) => ep.id)).toEqual(['a-1', 'a-2'])
  })

  it('leaves order alone by default, so a list someone is reading does not reshuffle as they listen', () => {
    const queue = orderListeningQueue([episode('a-1', 1 * DAY), episode('a-2', 2 * DAY, { progress: { currentTime: 120, lastUpdate: 9 } })])
    expect(queue.map((ep) => ep.id)).toEqual(['a-1', 'a-2'])
  })

  it('puts a started episode first when asked, so one play button cannot abandon it', () => {
    const queue = orderListeningQueue([episode('a-1', 1 * DAY), episode('a-2', 2 * DAY, { progress: { currentTime: 120, lastUpdate: 9 } })], { resumeFirst: true })
    expect(queue.map((ep) => ep.id)).toEqual(['a-2', 'a-1'])
  })

  it('orders several started episodes by what was played most recently', () => {
    const queue = orderListeningQueue([episode('a-1', 1 * DAY, { progress: { currentTime: 10, lastUpdate: 100 } }), episode('a-2', 2 * DAY, { progress: { currentTime: 10, lastUpdate: 900 } }), episode('a-3', 3 * DAY)], { resumeFirst: true })
    expect(queue.map((ep) => ep.id)).toEqual(['a-2', 'a-1', 'a-3'])
  })

  it('keeps unplayed episodes oldest-first behind the started ones', () => {
    const queue = orderListeningQueue([episode('a-3', 3 * DAY), episode('a-1', 1 * DAY), episode('a-2', 2 * DAY, { progress: { currentTime: 5, lastUpdate: 1 } })], { resumeFirst: true })
    expect(queue.map((ep) => ep.id)).toEqual(['a-2', 'a-1', 'a-3'])
  })

  it('reads started-ness from the device, not only from the episode payload', () => {
    const queue = orderListeningQueue([episode('a-1', 1 * DAY), episode('a-2', 2 * DAY)], {
      resumeFirst: true,
      lookup: { local: (_itemId, episodeId) => (episodeId === 'a-2' ? { currentTime: 30, lastUpdate: 5 } : null) }
    })
    expect(queue.map((ep) => ep.id)).toEqual(['a-2', 'a-1'])
  })

  it('survives an empty or holey list', () => {
    expect(orderListeningQueue()).toEqual([])
    expect(orderListeningQueue([null as unknown as ListeningEpisode, episode('a-1', DAY)]).map((ep) => ep.id)).toEqual(['a-1'])
  })
})

describe('toPlayQueueItems', () => {
  it('plays a downloaded episode by its local ids while reporting against the server ids', () => {
    // Getting this backwards streams a file that is already on disk, or reports progress against
    // an id the server has never heard of
    const [item] = toPlayQueueItems([episode('a-1', DAY)], () => ({ id: 'local-ep', localLibraryItemId: 'local-item' }))
    expect(item.libraryItemId).toBe('local-item')
    expect(item.episodeId).toBe('local-ep')
    expect(item.serverLibraryItemId).toBe('show-a')
    expect(item.serverEpisodeId).toBe('a-1')
  })

  it('streams when there is no download', () => {
    const [item] = toPlayQueueItems([episode('a-1', DAY)])
    expect(item.libraryItemId).toBe('show-a')
    expect(item.episodeId).toBe('a-1')
    expect(item.localEpisode).toBeNull()
  })

  it('streams when a local record exists but carries no library item of its own', () => {
    const [item] = toPlayQueueItems([episode('a-1', DAY)], () => ({ id: 'local-ep' }))
    expect(item.libraryItemId).toBe('show-a')
    expect(item.episodeId).toBe('a-1')
  })

  it('skips episodes with no server identity, which cannot be played or reported', () => {
    expect(toPlayQueueItems([{ publishedAt: DAY }, { id: 'a-1', publishedAt: DAY }, episode('a-2', DAY)])).toHaveLength(1)
  })
})

describe('queueItemStartTime', () => {
  it('resumes where an episode was left off', () => {
    const [item] = toPlayQueueItems([episode('a-1', DAY, { progress: { currentTime: 321 } })])
    expect(queueItemStartTime(item)).toBe(321)
  })

  it('starts an untouched episode from the beginning', () => {
    const [item] = toPlayQueueItems([episode('a-1', DAY)])
    expect(queueItemStartTime(item)).toBeNull()
  })

  it('does not resume into the last second of a finished episode', () => {
    const [item] = toPlayQueueItems([episode('a-1', DAY, { progress: { currentTime: 1799, isFinished: true } })])
    expect(queueItemStartTime(item)).toBeNull()
  })

  it('reads the resume point from the device when the episode payload has none', () => {
    const [item] = toPlayQueueItems([episode('a-1', DAY)])
    expect(queueItemStartTime(item, { local: () => ({ currentTime: 42 }) })).toBe(42)
  })
})

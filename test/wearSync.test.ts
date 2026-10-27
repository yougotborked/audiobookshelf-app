import { describe, it, expect } from 'vitest'
import { toWearQueueEntries, WEAR_QUEUE_LIMIT } from '../composables/useWearSync'
import { toPlayQueueItems } from '../composables/useListeningQueue'

function episode(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ep-1',
    libraryItemId: 'li-1',
    title: 'An episode',
    duration: 1800,
    ...overrides
  }
}

function items(episodes: Record<string, unknown>[], localFor: (e: any) => any = () => null) {
  return toPlayQueueItems(episodes as any, localFor)
}

describe('toWearQueueEntries', () => {
  it('maps an episode to what the watch needs', () => {
    const [entry] = toWearQueueEntries(items([episode({ podcast: { metadata: { title: 'A podcast' } } })]))
    expect(entry).toEqual({
      libraryItemId: 'li-1',
      episodeId: 'ep-1',
      title: 'An episode',
      podcastTitle: 'A podcast',
      coverPath: '/api/items/li-1/cover',
      durationSeconds: 1800,
      currentTimeSeconds: 0
    })
  })

  // The trap this exists for: toPlayQueueItems rewrites the ids to the phone's LOCAL ones when
  // a download exists, because that is what the phone's player needs. The watch has its own
  // downloads and talks to the server itself, so a local id would have it ask the server for
  // something that only exists in the phone's database.
  it('sends the server ids even when the phone has the episode downloaded', () => {
    const localFor = () => ({ id: 'local-ep', localLibraryItemId: 'local-li' })
    const queue = items([episode()], localFor)
    expect(queue[0].libraryItemId).toBe('local-li')

    const [entry] = toWearQueueEntries(queue)
    expect(entry.libraryItemId).toBe('li-1')
    expect(entry.episodeId).toBe('ep-1')
    expect(entry.coverPath).toBe('/api/items/li-1/cover')
  })

  it('carries resume position from the progress lookup', () => {
    const lookup = { server: () => ({ currentTime: 420, duration: 1800 }) }
    const [entry] = toWearQueueEntries(items([episode()]), lookup)
    expect(entry.currentTimeSeconds).toBe(420)
  })

  it('drops finished episodes', () => {
    const lookup = { server: () => ({ isFinished: true }) }
    expect(toWearQueueEntries(items([episode()]), lookup)).toEqual([])
  })

  it('keeps an episode whose progress is not finished', () => {
    const lookup = { server: () => ({ currentTime: 10, isFinished: false }) }
    expect(toWearQueueEntries(items([episode()]), lookup)).toHaveLength(1)
  })

  it('treats a negative or missing position as the start', () => {
    const lookup = { server: () => ({ currentTime: -5 }) }
    expect(toWearQueueEntries(items([episode()]), lookup)[0].currentTimeSeconds).toBe(0)
    expect(toWearQueueEntries(items([episode()]))[0].currentTimeSeconds).toBe(0)
  })

  it('falls back to a flat podcast title, then to blank', () => {
    expect(toWearQueueEntries(items([episode({ podcastTitle: 'Flat' })]))[0].podcastTitle).toBe('Flat')
    expect(toWearQueueEntries(items([episode()]))[0].podcastTitle).toBe('')
  })

  it('names an untitled episode rather than sending an empty row', () => {
    expect(toWearQueueEntries(items([episode({ title: '' })]))[0].title).toBe('Untitled episode')
  })

  it('reports an unknown duration as zero rather than something made up', () => {
    expect(toWearQueueEntries(items([episode({ duration: undefined })]))[0].durationSeconds).toBe(0)
    expect(toWearQueueEntries(items([episode({ duration: -1 })]))[0].durationSeconds).toBe(0)
  })

  // A catch-up queue runs to 200. The watch will download these onto a device whose storage is
  // shared with everything else, so the cut happens before they cross the link.
  it('caps the queue at the watch limit', () => {
    const many = Array.from({ length: 50 }, (_, i) => episode({ id: `ep-${i}` }))
    expect(toWearQueueEntries(items(many))).toHaveLength(WEAR_QUEUE_LIMIT)
  })

  it('keeps the queue order', () => {
    const queue = items([episode({ id: 'a' }), episode({ id: 'b' }), episode({ id: 'c' })])
    expect(toWearQueueEntries(queue).map((e) => e.episodeId)).toEqual(['a', 'b', 'c'])
  })

  // The cap counts what is sent, not what was considered: dropping finished episodes after
  // slicing would hand the watch a short queue on a week of heavy listening.
  it('fills the cap with unfinished episodes rather than counting dropped ones', () => {
    const many = Array.from({ length: 60 }, (_, i) => episode({ id: `ep-${i}` }))
    const finishedIds = new Set(many.slice(0, 30).map((e) => e.id))
    const lookup = { server: (_li: string, epId: string) => (finishedIds.has(epId) ? { isFinished: true } : null) }
    const entries = toWearQueueEntries(items(many), lookup)
    expect(entries).toHaveLength(WEAR_QUEUE_LIMIT)
    expect(entries[0].episodeId).toBe('ep-30')
  })

  it('skips an item with no episode or no ids', () => {
    expect(toWearQueueEntries([{ libraryItemId: 'x', episodeId: 'y' } as any])).toEqual([])
    expect(toWearQueueEntries(items([episode({ id: undefined })]))).toEqual([])
  })

  it('handles an empty queue', () => {
    expect(toWearQueueEntries()).toEqual([])
    expect(toWearQueueEntries([])).toEqual([])
  })
})

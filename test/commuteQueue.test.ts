import { describe, expect, it } from 'vitest'
import { episodeRemainingSeconds, fillTimeBudget, type ListeningEpisode } from '~/composables/useListeningQueue'

const ep = (id: string, duration: number, extra: Partial<ListeningEpisode> = {}): ListeningEpisode => ({
  id,
  libraryItemId: 'lib',
  duration,
  ...extra
})

const MIN = 60

describe('episodeRemainingSeconds', () => {
  it('is the whole episode when nothing has been heard', () => {
    expect(episodeRemainingSeconds(ep('a', 1800))).toBe(1800)
  })

  it('is what is left when some has', () => {
    // The point of the whole feature: a 30 minute episode with 25 minutes heard is a 5 minute
    // item, and a budget that treats it as 30 fits one thing where three would have gone.
    expect(episodeRemainingSeconds(ep('a', 1800, { progress: { currentTime: 1500 } }))).toBe(300)
  })

  it('is zero once finished, however that was recorded', () => {
    expect(episodeRemainingSeconds(ep('a', 1800, { progress: { isFinished: true } }))).toBe(0)
  })

  it('is null when the feed did not say how long it is', () => {
    // Rather than a guess. A queue built on invented lengths is worse than one that leaves the
    // episode out.
    expect(episodeRemainingSeconds(ep('a', 0))).toBeNull()
    expect(episodeRemainingSeconds({ id: 'a' })).toBeNull()
  })
})

describe('fillTimeBudget', () => {
  it('takes as many as fit, in the order given', () => {
    const episodes = [ep('a', 600), ep('b', 900), ep('c', 600)]
    const queue = fillTimeBudget(episodes, 40 * 60)

    expect(queue.episodes.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(queue.totalSeconds).toBe(2100)
    expect(queue.remainingSeconds).toBe(300)
  })

  it('never overruns the budget', () => {
    // The promise is "this fits". An episode running past arrival is fine in life and wrong in
    // a promise, so the queue is handed over without an asterisk.
    const queue = fillTimeBudget([ep('a', 600), ep('b', 3000)], 20 * 60)
    expect(queue.episodes.map((e) => e.id)).toEqual(['a'])
    expect(queue.totalSeconds).toBeLessThanOrEqual(20 * 60)
    expect(queue.remainingSeconds).toBeGreaterThanOrEqual(0)
  })

  it('skips what does not fit and keeps going', () => {
    // One four-hour episode near the top must not empty the rest of the commute.
    const queue = fillTimeBudget([ep('long', 4 * 3600), ep('a', 600), ep('b', 600)], 30 * 60)
    expect(queue.episodes.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('counts a part-heard episode by what is left of it', () => {
    // 'a' looks too long at 30 minutes but has 5 left, so it fits a 10 minute budget and 'b'
    // does not follow it.
    const episodes = [ep('a', 1800, { progress: { currentTime: 1500 } }), ep('b', 600)]
    const queue = fillTimeBudget(episodes, 10 * 60)
    expect(queue.episodes.map((e) => e.id)).toEqual(['a'])
    expect(queue.totalSeconds).toBe(300)
  })

  it('leaves out episodes that are already finished', () => {
    const queue = fillTimeBudget([ep('done', 600, { progress: { isFinished: true } }), ep('a', 600)], 30 * 60)
    expect(queue.episodes.map((e) => e.id)).toEqual(['a'])
  })

  it('leaves out episodes of unknown length rather than guessing', () => {
    const queue = fillTimeBudget([{ id: 'nolength' }, ep('a', 600)], 30 * 60)
    expect(queue.episodes.map((e) => e.id)).toEqual(['a'])
  })

  it('stops once the leftover is too small to be worth filling', () => {
    // A 20 second tail on a commute is noise, not service.
    const queue = fillTimeBudget([ep('a', 600), ep('tiny', 20)], 600 + 30, { minimumFitSeconds: MIN })
    expect(queue.episodes.map((e) => e.id)).toEqual(['a'])
  })

  it('returns an empty queue rather than throwing on a nonsense budget', () => {
    for (const budget of [0, -600, Number.NaN]) {
      const queue = fillTimeBudget([ep('a', 600)], budget)
      expect(queue.episodes).toEqual([])
      expect(queue.remainingSeconds).toBe(0)
    }
  })
})

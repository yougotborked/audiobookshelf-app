import { describe, expect, it } from 'vitest'
import { ACHIEVEMENT_TIERS, earnedAchievements, evaluateAchievements, listeningStreak, metricValue, nextAchievement, shiftDateKey, toDateKey, type ListeningDays, type ListeningSummary } from '~/composables/useAchievements'

// The streak was a `while (true)` loop inside a chart component's computed properties, with
// overflow protection standing in for a terminating condition. It is the number people care about
// keeping, so it is worth being able to prove it counts right.

const TODAY = new Date('2026-03-15T10:00:00')

/** Days listened, counting back from TODAY. `daysAgo(0)` is today. */
function daysAgo(...offsets: number[]): ListeningDays {
  const days: ListeningDays = {}
  for (const offset of offsets) days[shiftDateKey(TODAY, -offset)] = 30
  return days
}

describe('toDateKey', () => {
  it('zero-pads, so keys sort as dates', () => {
    expect(toDateKey(new Date('2026-03-05T00:00:00'))).toBe('2026-03-05')
    expect(toDateKey(new Date('2026-11-25T00:00:00'))).toBe('2026-11-25')
  })

  it('uses local time, so the key is the day the user thinks they are in', () => {
    // Late evening local must not roll forward into tomorrow's key
    expect(toDateKey(new Date('2026-03-15T23:30:00'))).toBe('2026-03-15')
  })
})

describe('shiftDateKey', () => {
  it('crosses a month boundary', () => {
    expect(shiftDateKey(new Date('2026-03-01T12:00:00'), -1)).toBe('2026-02-28')
  })

  it('crosses a leap day', () => {
    expect(shiftDateKey(new Date('2024-03-01T12:00:00'), -1)).toBe('2024-02-29')
  })

  it('crosses a year boundary', () => {
    expect(shiftDateKey(new Date('2026-01-01T12:00:00'), -1)).toBe('2025-12-31')
  })
})

describe('listeningStreak', () => {
  it('counts a run ending today', () => {
    expect(listeningStreak(daysAgo(0, 1, 2), TODAY).current).toBe(3)
  })

  it('keeps a streak alive before today has been listened to', () => {
    // Otherwise every streak reads zero each midnight until the user happens to press play
    expect(listeningStreak(daysAgo(1, 2, 3), TODAY).current).toBe(3)
  })

  it('ends a run once a day is skipped entirely', () => {
    // Nothing today and nothing yesterday: the run is over
    expect(listeningStreak(daysAgo(2, 3, 4), TODAY).current).toBe(0)
  })

  it('stops at a gap rather than counting every day recorded', () => {
    expect(listeningStreak(daysAgo(0, 1, 3, 4, 5), TODAY).current).toBe(2)
  })

  it('does not count a day with a recorded zero', () => {
    // The server records the day; it does not mean anything was heard
    const days = { ...daysAgo(0, 2), [shiftDateKey(TODAY, -1)]: 0 }
    expect(listeningStreak(days, TODAY).current).toBe(1)
  })

  it('reports the longest run ever, not just the current one', () => {
    expect(listeningStreak(daysAgo(0, 1, 10, 11, 12, 13, 14), TODAY).longest).toBe(5)
  })

  it('never reports a longest shorter than the current run', () => {
    const streak = listeningStreak(daysAgo(0, 1, 2, 3), TODAY)
    expect(streak.longest).toBeGreaterThanOrEqual(streak.current)
  })

  it('counts a run that crosses a month boundary', () => {
    const march1 = new Date('2026-03-01T10:00:00')
    expect(listeningStreak({ '2026-03-01': 10, '2026-02-28': 10, '2026-02-27': 10 }, march1).current).toBe(3)
  })

  it('is zero for someone who has never listened', () => {
    expect(listeningStreak({}, TODAY)).toEqual({ current: 0, longest: 0 })
    expect(listeningStreak(undefined, TODAY)).toEqual({ current: 0, longest: 0 })
  })
})

describe('metricValue', () => {
  const summary: ListeningSummary = { totalMinutes: 100, itemsFinished: 5, daysListened: 7, currentStreak: 2, longestStreak: 9 }

  it('reads each metric off the summary', () => {
    expect(metricValue(summary, 'minutes')).toBe(100)
    expect(metricValue(summary, 'finished')).toBe(5)
    expect(metricValue(summary, 'days')).toBe(7)
  })

  it('measures streak badges against the best run ever', () => {
    // Measuring the current run would take a badge away the first day someone misses, which is a
    // punishment rather than an achievement
    expect(metricValue(summary, 'streak')).toBe(9)
  })
})

describe('evaluateAchievements', () => {
  const none: ListeningSummary = { totalMinutes: 0, itemsFinished: 0, daysListened: 0, currentStreak: 0, longestStreak: 0 }

  it('earns a tier exactly at its threshold', () => {
    const tiers = evaluateAchievements({ ...none, itemsFinished: 10 })
    expect(tiers.find((t) => t.id === 'finished-10')?.earned).toBe(true)
  })

  it('does not earn a tier one short of it', () => {
    const tiers = evaluateAchievements({ ...none, itemsFinished: 9 })
    expect(tiers.find((t) => t.id === 'finished-10')?.earned).toBe(false)
  })

  it('reports partial progress toward an unearned tier', () => {
    const tier = evaluateAchievements({ ...none, itemsFinished: 5 }).find((t) => t.id === 'finished-10')
    expect(tier?.progress).toBeCloseTo(0.5)
  })

  it('caps progress at 1 once earned, so a bar cannot overflow', () => {
    const tier = evaluateAchievements({ ...none, itemsFinished: 999 }).find((t) => t.id === 'finished-10')
    expect(tier?.progress).toBe(1)
  })

  it('earns nothing on an empty history', () => {
    expect(evaluateAchievements(none).every((t) => !t.earned)).toBe(true)
  })

  it('has unique tier ids, so a list render cannot collide on keys', () => {
    const ids = ACHIEVEMENT_TIERS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('earnedAchievements', () => {
  it('leads with the hardest badge earned', () => {
    const evaluated = evaluateAchievements({ totalMinutes: 0, itemsFinished: 60, daysListened: 0, currentStreak: 0, longestStreak: 0 })
    expect(earnedAchievements(evaluated)[0]?.id).toBe('finished-50')
  })

  it('is empty when nothing is earned', () => {
    expect(earnedAchievements(evaluateAchievements({ totalMinutes: 0, itemsFinished: 0, daysListened: 0, currentStreak: 0, longestStreak: 0 }))).toEqual([])
  })
})

describe('nextAchievement', () => {
  it('offers the closest badge by proportion, not by raw distance', () => {
    // 8 of 10 days beats 1 of 60 minutes, though 2 days is the smaller absolute gap
    const next = nextAchievement(evaluateAchievements({ totalMinutes: 1, itemsFinished: 0, daysListened: 8, currentStreak: 0, longestStreak: 0 }))
    expect(next?.id).toBe('days-10')
  })

  it('never offers one already earned', () => {
    const next = nextAchievement(evaluateAchievements({ totalMinutes: 0, itemsFinished: 10, daysListened: 0, currentStreak: 0, longestStreak: 0 }))
    expect(next?.earned).toBe(false)
  })

  it('is null once every badge is earned', () => {
    expect(nextAchievement(evaluateAchievements({ totalMinutes: 1e9, itemsFinished: 1e9, daysListened: 1e9, currentStreak: 1e9, longestStreak: 1e9 }))).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { ACHIEVEMENT_TIERS, BADGE_RANK_NAMES, describeProgress, describeRequirement, evaluateAchievements, formatMetricValue, groupByMetric, nextPerMetric } from '../composables/useAchievements'

const summary = { totalMinutes: 0, itemsFinished: 0, daysListened: 0, currentStreak: 0, longestStreak: 0 }

describe('the badge ladder', () => {
  it('has a unique id per badge', () => {
    const ids = ACHIEVEMENT_TIERS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every badge a rank the palette knows about', () => {
    for (const tier of ACHIEVEMENT_TIERS) {
      expect(BADGE_RANK_NAMES[tier.rank]).toBeTruthy()
    }
  })

  // The reason the higher tiers exist: a heavy user clears the old ceiling and has nothing left
  // to aim at, which is the opposite of what a badge is for.
  it('keeps climbing past the old ceilings', () => {
    const top = (metric: string) => Math.max(...ACHIEVEMENT_TIERS.filter((t) => t.metric === metric).map((t) => t.threshold))
    expect(top('minutes')).toBeGreaterThan(30000)
    expect(top('finished')).toBeGreaterThan(1000)
    expect(top('streak')).toBeGreaterThan(365)
    expect(top('days')).toBeGreaterThan(365)
  })

  it('never makes a harder badge a lower rank than an easier one in the same ladder', () => {
    for (const group of groupByMetric(evaluateAchievements(summary))) {
      const ranks = group.tiers.map((t) => t.rank)
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    }
  })
})

describe('formatMetricValue', () => {
  // Minutes are what everything is stored in and nothing is counted in.
  it('turns minutes into hours once there is an hour', () => {
    expect(formatMetricValue('minutes', 30000)).toBe('500 hours')
    expect(formatMetricValue('minutes', 60)).toBe('1 hour')
  })

  it('keeps minutes below an hour', () => {
    expect(formatMetricValue('minutes', 45)).toBe('45 min')
  })

  it('counts episodes and days in their own units', () => {
    expect(formatMetricValue('finished', 250)).toBe('250 episodes')
    expect(formatMetricValue('finished', 1)).toBe('1 episode')
    expect(formatMetricValue('days', 1)).toBe('1 day')
    expect(formatMetricValue('days', 365)).toBe('365 days')
  })

  it('never reports a negative amount', () => {
    expect(formatMetricValue('finished', -5)).toBe('0 episodes')
  })
})

describe('describeRequirement', () => {
  it('says plainly what each metric asks for', () => {
    const find = (id: string) => ACHIEVEMENT_TIERS.find((t) => t.id === id)!
    expect(describeRequirement(find('minutes-30000'))).toBe('Listen for 500 hours')
    expect(describeRequirement(find('finished-250'))).toBe('Finish 250 episodes')
    expect(describeRequirement(find('streak-100'))).toBe('Listen 100 days in a row')
    expect(describeRequirement(find('days-365'))).toBe('Listen on 365 days')
  })

  // The titles are flavour, which is the point of them and no help in working out the ask.
  it('never just repeats the flavour title', () => {
    for (const tier of ACHIEVEMENT_TIERS) {
      expect(describeRequirement(tier)).not.toBe(tier.title)
    }
  })
})

describe('describeProgress', () => {
  it('reads as a fraction when both sides share a unit', () => {
    const evaluated = evaluateAchievements({ ...summary, itemsFinished: 100 })
    const tier = evaluated.find((t) => t.id === 'finished-250')!
    expect(describeProgress(tier)).toBe('100 of 250 episodes')
  })

  it('shows the requirement once there is nothing left to do', () => {
    const evaluated = evaluateAchievements({ ...summary, itemsFinished: 400 })
    const tier = evaluated.find((t) => t.id === 'finished-250')!
    expect(describeProgress(tier)).toBe('Finish 250 episodes')
  })

  it('keeps both units when they differ', () => {
    const evaluated = evaluateAchievements({ ...summary, totalMinutes: 30 })
    const tier = evaluated.find((t) => t.id === 'minutes-600')!
    expect(describeProgress(tier)).toBe('30 min of 10 hours')
  })
})

describe('nextPerMetric', () => {
  it('offers one target per ladder rather than a single global next', () => {
    const evaluated = evaluateAchievements({ ...summary, totalMinutes: 100, itemsFinished: 5 })
    const metrics = nextPerMetric(evaluated).map((t) => t.metric)
    expect(new Set(metrics).size).toBe(metrics.length)
    expect(metrics).toContain('minutes')
    expect(metrics).toContain('finished')
  })

  // The ladder is climbed in order, so the next rung is the nearest threshold - not whichever
  // badge happens to be the largest fraction complete.
  it('picks the lowest unearned threshold in each ladder', () => {
    const evaluated = evaluateAchievements({ ...summary, itemsFinished: 12 })
    const next = nextPerMetric(evaluated).find((t) => t.metric === 'finished')!
    expect(next.id).toBe('finished-50')
  })

  it('offers nothing for a ladder that is fully cleared', () => {
    const evaluated = evaluateAchievements({ ...summary, itemsFinished: 999999 })
    expect(nextPerMetric(evaluated).some((t) => t.metric === 'finished')).toBe(false)
  })
})

describe('groupByMetric', () => {
  const groups = groupByMetric(evaluateAchievements(summary))

  it('returns every ladder, labelled', () => {
    expect(groups.map((g) => g.metric)).toEqual(['minutes', 'finished', 'streak', 'days'])
    for (const group of groups) expect(group.label.length).toBeGreaterThan(0)
  })

  it('orders each ladder easiest first, so a wall reads left to right', () => {
    for (const group of groups) {
      const thresholds = group.tiers.map((t) => t.threshold)
      expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b))
    }
  })

  it('accounts for every badge exactly once', () => {
    expect(groups.flatMap((g) => g.tiers).length).toBe(ACHIEVEMENT_TIERS.length)
  })
})

/**
 * Listening streaks and the badges built on them.
 *
 * The streak was a `while (true)` loop inside `DailyListeningChart`'s computed properties, with
 * overflow protection standing in for a terminating condition and no way to exercise any of it.
 * It is the one number on the stats screen people actually care about keeping, so it is worth
 * being able to prove it counts correctly - including the awkward parts: a day with a zero
 * recorded against it is not a day listened, and not having listened *yet today* must not break
 * a streak that is still alive.
 *
 * Everything here is pure. Dates come in as `yyyy-MM-dd` keys, which is what the server's
 * listening-stats `days` map uses, and "today" is passed in rather than read from the clock.
 */

/** A `yyyy-MM-dd` key, as the listening-stats `days` map is keyed. */
export type DateKey = string

/** Seconds (or minutes - the unit does not matter here) listened, keyed by day. */
export type ListeningDays = Record<DateKey, number>

export interface ListeningStreak {
  /** Days up to and including today, still running. */
  current: number
  /** The best run ever recorded. */
  longest: number
}

/** The `yyyy-MM-dd` key for a date, in local time - the same day the user thinks they are in. */
export function toDateKey(date: Date): DateKey {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** The key `offset` days from `date`, negative for the past. */
export function shiftDateKey(date: Date, offset: number): DateKey {
  const shifted = new Date(date.getTime())
  shifted.setDate(shifted.getDate() + offset)
  return toDateKey(shifted)
}

/** Whether a day counts as listened. A recorded zero is a day the server knows about, not a day heard. */
function listenedOn(days: ListeningDays, key: DateKey): boolean {
  return !!days[key]
}

/**
 * The current and longest run of consecutive days with listening.
 *
 * The current run allows one day of grace: a streak that reaches yesterday is still alive until
 * today is over. Counting from today alone would show every streak collapsing to zero each
 * midnight and only recovering once the user happened to press play.
 */
export function listeningStreak(days: ListeningDays = {}, today: Date = new Date()): ListeningStreak {
  const keys = Object.keys(days).filter((key) => listenedOn(days, key))
  if (!keys.length) return { current: 0, longest: 0 }

  const listened = new Set(keys)

  // Current: walk back from today, or from yesterday when today has not happened yet
  let current = 0
  const startOffset = listened.has(toDateKey(today)) ? 0 : -1
  // Nothing today and nothing yesterday means the run is over
  if (listened.has(shiftDateKey(today, startOffset))) {
    for (let offset = startOffset; ; offset--) {
      if (!listened.has(shiftDateKey(today, offset))) break
      current++
    }
  }

  // Longest: sort the days and count consecutive runs. Sorting lexicographically is safe because
  // a zero-padded yyyy-MM-dd sorts the same as the date it names.
  const sorted = [...listened].sort()
  let longest = 0
  let run = 0
  let previous: string | null = null
  for (const key of sorted) {
    const expected = previous ? shiftDateKey(new Date(`${previous}T00:00:00`), 1) : null
    run = expected === key ? run + 1 : 1
    if (run > longest) longest = run
    previous = key
  }

  // No Math.max against `current` here: every day in the current run is in the same set this
  // scan walks, so `longest` cannot come out smaller. The invariant is tested rather than forced.
  return { current, longest }
}

/** What the badges are measured against. */
export interface ListeningSummary {
  totalMinutes: number
  itemsFinished: number
  daysListened: number
  currentStreak: number
  longestStreak: number
}

export type AchievementMetric = 'minutes' | 'finished' | 'days' | 'streak'

export interface AchievementTier {
  id: string
  metric: AchievementMetric
  /** The value this tier needs. */
  threshold: number
  title: string
  description: string
  /** A Material Symbols name. */
  icon: string
  /**
   * How hard this one is, 1-5.
   *
   * Not derived from the threshold, because thresholds are not comparable across metrics - a
   * thousand episodes and a thousand-day streak are wildly different asks. Stated per badge so
   * the ladder can be re-tuned without the colours silently rearranging themselves.
   */
  rank: BadgeRank
}

/** Bronze through mythic. Drives the badge's colour and nothing else. */
export type BadgeRank = 1 | 2 | 3 | 4 | 5

export const BADGE_RANK_NAMES: Record<BadgeRank, string> = {
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
  4: 'Platinum',
  5: 'Mythic'
}

export interface EvaluatedAchievement extends AchievementTier {
  earned: boolean
  /** How far toward this tier, 0-1. 1 once earned. */
  progress: number
  /** The value being measured, for "12 / 50" style labels. */
  value: number
}

/**
 * The badge ladder.
 *
 * Deliberately a plain list rather than generated: the thresholds are judgement calls about what
 * is worth celebrating, and the names only work if they are written rather than derived.
 */
export const ACHIEVEMENT_TIERS: AchievementTier[] = [
  // Minutes listened. The top two were added because a heavy user clears five hundred hours in
  // a year and then has nothing left to aim at, which is the opposite of what a badge is for.
  { id: 'minutes-60', metric: 'minutes', threshold: 60, title: 'First Hour', description: 'An hour of listening', icon: 'hourglass_bottom', rank: 1 },
  { id: 'minutes-600', metric: 'minutes', threshold: 600, title: 'Ten Hours', description: 'Ten hours in', icon: 'schedule', rank: 1 },
  { id: 'minutes-3000', metric: 'minutes', threshold: 3000, title: 'Fifty Hours', description: 'Fifty hours of listening', icon: 'history_toggle_off', rank: 2 },
  { id: 'minutes-6000', metric: 'minutes', threshold: 6000, title: 'Hundred Club', description: 'A hundred hours', icon: 'avg_pace', rank: 3 },
  { id: 'minutes-30000', metric: 'minutes', threshold: 30000, title: 'Five Hundred', description: 'Five hundred hours', icon: 'local_fire_department', rank: 4 },
  { id: 'minutes-60000', metric: 'minutes', threshold: 60000, title: 'Thousand Hours', description: 'A thousand hours of listening', icon: 'bolt', rank: 5 },
  { id: 'minutes-150000', metric: 'minutes', threshold: 150000, title: 'Deep Catalogue', description: 'Two and a half thousand hours', icon: 'diamond', rank: 5 },

  { id: 'finished-1', metric: 'finished', threshold: 1, title: 'Opening Credits', description: 'Finished your first episode', icon: 'play_circle', rank: 1 },
  { id: 'finished-10', metric: 'finished', threshold: 10, title: 'Regular', description: 'Ten episodes finished', icon: 'headphones', rank: 1 },
  { id: 'finished-50', metric: 'finished', threshold: 50, title: 'Devoted', description: 'Fifty episodes finished', icon: 'podcasts', rank: 2 },
  { id: 'finished-250', metric: 'finished', threshold: 250, title: 'Completionist', description: 'Two hundred and fifty finished', icon: 'workspace_premium', rank: 3 },
  { id: 'finished-1000', metric: 'finished', threshold: 1000, title: 'Archivist', description: 'A thousand episodes finished', icon: 'inventory_2', rank: 4 },
  { id: 'finished-2500', metric: 'finished', threshold: 2500, title: 'Librarian', description: 'Two and a half thousand finished', icon: 'auto_stories', rank: 5 },
  { id: 'finished-5000', metric: 'finished', threshold: 5000, title: 'Encyclopaedist', description: 'Five thousand episodes finished', icon: 'hive', rank: 5 },

  { id: 'streak-3', metric: 'streak', threshold: 3, title: 'Habit Forming', description: 'Three days running', icon: 'bolt', rank: 1 },
  { id: 'streak-7', metric: 'streak', threshold: 7, title: 'Full Week', description: 'Seven days running', icon: 'calendar_view_week', rank: 1 },
  { id: 'streak-30', metric: 'streak', threshold: 30, title: 'Monthly', description: 'Thirty days running', icon: 'calendar_month', rank: 2 },
  { id: 'streak-100', metric: 'streak', threshold: 100, title: 'Unbroken', description: 'A hundred days running', icon: 'military_tech', rank: 3 },
  { id: 'streak-365', metric: 'streak', threshold: 365, title: 'Year Round', description: 'A full year, every day', icon: 'emoji_events', rank: 4 },
  { id: 'streak-500', metric: 'streak', threshold: 500, title: 'Relentless', description: 'Five hundred days running', icon: 'whatshot', rank: 5 },
  { id: 'streak-1000', metric: 'streak', threshold: 1000, title: 'Thousand Days', description: 'A thousand days without missing one', icon: 'stars', rank: 5 },

  { id: 'days-10', metric: 'days', threshold: 10, title: 'Getting Started', description: 'Listened on ten days', icon: 'today', rank: 1 },
  { id: 'days-100', metric: 'days', threshold: 100, title: 'Hundred Days', description: 'Listened on a hundred days', icon: 'event_available', rank: 2 },
  { id: 'days-365', metric: 'days', threshold: 365, title: 'Year of Listening', description: 'Listened on 365 days', icon: 'auto_awesome', rank: 3 },
  { id: 'days-730', metric: 'days', threshold: 730, title: 'Two Years In', description: 'Listened on 730 days', icon: 'nature', rank: 4 },
  { id: 'days-1500', metric: 'days', threshold: 1500, title: 'Long Haul', description: 'Listened on 1500 days', icon: 'landscape', rank: 5 }
]

/** The summary value a tier is measured against. Longest streak counts, so a badge once earned stays earned. */
export function metricValue(summary: ListeningSummary, metric: AchievementMetric): number {
  if (metric === 'minutes') return summary.totalMinutes
  if (metric === 'finished') return summary.itemsFinished
  if (metric === 'days') return summary.daysListened
  // A streak badge records the best run ever reached. Measuring the current one would take a
  // badge away the first day someone misses, which is a punishment, not an achievement.
  return Math.max(summary.longestStreak, summary.currentStreak)
}

/** Every tier, with whether it is earned and how far toward it. */
export function evaluateAchievements(summary: ListeningSummary, tiers: AchievementTier[] = ACHIEVEMENT_TIERS): EvaluatedAchievement[] {
  return tiers.map((tier) => {
    const value = Math.max(metricValue(summary, tier.metric), 0)
    const earned = value >= tier.threshold
    return {
      ...tier,
      value,
      earned,
      progress: earned ? 1 : Math.min(Math.max(value / tier.threshold, 0), 1)
    }
  })
}

/** Earned badges, hardest first, so the showcase leads with the best one. */
export function earnedAchievements(evaluated: EvaluatedAchievement[]): EvaluatedAchievement[] {
  return evaluated.filter((tier) => tier.earned).sort((a, b) => b.threshold - a.threshold)
}

/**
 * The closest unearned badge - the one worth showing as "next".
 *
 * Closest by proportion rather than by absolute distance, so "8 of 10 days" is offered ahead of
 * "6000 of 30000 minutes" even though the second is a smaller fraction of a much bigger number.
 */
export function nextAchievement(evaluated: EvaluatedAchievement[]): EvaluatedAchievement | null {
  const unearned = evaluated.filter((tier) => !tier.earned)
  if (!unearned.length) return null
  return unearned.reduce((best, tier) => (tier.progress > best.progress ? tier : best))
}

/**
 * A metric's value in the units people think in.
 *
 * Minutes are the unit everything is stored in and nobody counts in: "30000 minutes" is a
 * number you have to do arithmetic on before it means anything, where "500 hours" is a fact.
 */
export function formatMetricValue(metric: AchievementMetric, value: number): string {
  const safe = Math.max(Math.round(value), 0)
  if (metric === 'minutes') {
    if (safe < 60) return `${safe} min`
    const hours = Math.round(safe / 60)
    return `${hours.toLocaleString()} ${hours === 1 ? 'hour' : 'hours'}`
  }
  if (metric === 'finished') return `${safe.toLocaleString()} ${safe === 1 ? 'episode' : 'episodes'}`
  return `${safe.toLocaleString()} ${safe === 1 ? 'day' : 'days'}`
}

/**
 * What a badge asks for, as a sentence.
 *
 * The badges carry flavour titles - "Archivist", "Deep Catalogue" - which is the point of them
 * and useless for working out what you have to do. This is the plain version that sits
 * underneath.
 */
export function describeRequirement(tier: AchievementTier): string {
  const amount = formatMetricValue(tier.metric, tier.threshold)
  switch (tier.metric) {
    case 'minutes':
      return `Listen for ${amount}`
    case 'finished':
      return `Finish ${amount}`
    case 'streak':
      return `Listen ${amount} in a row`
    case 'days':
      return `Listen on ${amount}`
  }
}

/** "250 of 500 hours", or the requirement once there is nothing left to do. */
export function describeProgress(tier: EvaluatedAchievement): string {
  if (tier.earned) return describeRequirement(tier)
  const unit = formatMetricValue(tier.metric, tier.threshold)
  const soFar = formatMetricValue(tier.metric, tier.value)
  // Only the target carries the unit when both share one, so it reads as a fraction rather
  // than as two separate measurements.
  const sameUnit = unit.replace(/^[\d,]+\s/, '') === soFar.replace(/^[\d,]+\s/, '')
  return sameUnit ? `${soFar.replace(/\s.*$/, '')} of ${unit}` : `${soFar} of ${unit}`
}

/**
 * The next badge to aim at in each metric, for someone who has cleared the easy ones.
 *
 * A single global "next" stops being useful once most of the wall is earned: it picks whichever
 * one happens to be closest and says nothing about the other three ladders, which is exactly
 * when a heavy user wants to know where the remaining room is.
 */
export function nextPerMetric(evaluated: EvaluatedAchievement[]): EvaluatedAchievement[] {
  const byMetric = new Map<AchievementMetric, EvaluatedAchievement>()
  for (const tier of evaluated) {
    if (tier.earned) continue
    const current = byMetric.get(tier.metric)
    // Lowest unearned threshold per metric: the ladder is climbed in order, so the next rung is
    // the nearest one, not the most nearly complete.
    if (!current || tier.threshold < current.threshold) byMetric.set(tier.metric, tier)
  }
  return [...byMetric.values()]
}

/** Badges grouped into their ladders, each in threshold order, for a wall that reads as rows. */
export function groupByMetric(evaluated: EvaluatedAchievement[]): { metric: AchievementMetric; label: string; tiers: EvaluatedAchievement[] }[] {
  const labels: Record<AchievementMetric, string> = {
    minutes: 'Time listened',
    finished: 'Episodes finished',
    streak: 'Streaks',
    days: 'Days listened'
  }
  const order: AchievementMetric[] = ['minutes', 'finished', 'streak', 'days']
  return order
    .map((metric) => ({
      metric,
      label: labels[metric],
      tiers: evaluated.filter((tier) => tier.metric === metric).sort((a, b) => a.threshold - b.threshold)
    }))
    .filter((group) => group.tiers.length > 0)
}

import { addDays, todayISO } from './weeks'
import type { Exercise, StreakState, TrainingDay, WorkoutSession } from '../types'

const MAX_LOOKBACK_DAYS = 400

export type StreakInfo = {
  current: number
  longest: number
  todayDone: boolean
  todayIsRest: boolean
  /** Which picture to show right now. */
  state: StreakState
}

/** A weekday with no exercises planned is a rest day. */
export function restWeekdays(days: TrainingDay[], exercises: Exercise[]): Set<number> {
  const withExercises = new Set(exercises.map(e => e.day_id))
  return new Set(days.filter(day => !withExercises.has(day.id)).map(day => day.day_of_week))
}

function weekdayOf(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return ((new Date(y, m - 1, d).getDay() + 6) % 7) + 1
}

/**
 * Counts consecutive days. A rest day neither breaks the streak nor adds to it.
 * Today never breaks it — there is still time left to train.
 */
export function computeStreak(sessions: WorkoutSession[], rest: Set<number>, now = new Date()): StreakInfo {
  const today = todayISO()
  const done = new Set(sessions.map(s => s.session_date))
  const todayIsRest = rest.has(weekdayOf(today))
  const todayDone = done.has(today)

  let current = todayDone ? 1 : 0
  let day = addDays(today, -1)
  // Bounded: with every weekday marked as rest there would be nothing to stop on.
  for (let step = 0; step < MAX_LOOKBACK_DAYS; step++) {
    if (done.has(day)) current += 1
    else if (!rest.has(weekdayOf(day))) break
    day = addDays(day, -1)
  }

  // Longest streak over everything we loaded, using the same rules.
  let longest = 0
  let run = 0
  const sorted = [...done].sort()
  const first = sorted[0]
  if (first) {
    for (let day = first; day <= today; day = addDays(day, 1)) {
      if (done.has(day)) {
        run += 1
        longest = Math.max(longest, run)
      } else if (!rest.has(weekdayOf(day)) && day !== today) {
        run = 0
      }
    }
  }
  longest = Math.max(longest, current)

  const hour = now.getHours()
  const state: StreakState = todayIsRest ? 'rest' : todayDone || hour < 12 ? 'chill' : hour < 18 ? 'stressed' : 'angry'

  return { current, longest, todayDone, todayIsRest, state }
}

export const STATE_LABELS: Record<StreakState, string> = {
  chill: 'Chill',
  stressed: 'Getting nervous',
  angry: 'Angry',
  rest: 'Rest day',
  celebration: 'New record',
}

export const STATE_HINTS: Record<StreakState, string> = {
  chill: 'Morning, and after the workout is logged',
  stressed: 'Midday, still no workout',
  angry: 'Evening, still no workout',
  rest: 'Days with no exercises planned',
  celebration: 'When he beats a personal record',
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Logo, LogOut } from '../components/Icons'
import { ErrorState, Loading, OfflineBanner } from '../components/Status'
import TabBar from '../components/TabBar'
import { fetchDays, fetchExercises, fetchSets, signOut } from '../lib/api'
import { errorMessage, hasValues, plural } from '../lib/format'
import { DAY_NAMES, DAY_SHORT, currentWeekStart, formatWeekRange, todayDayOfWeek } from '../lib/weeks'
import type { Exercise, ExerciseSet, TrainingDay } from '../types'

type WeekData = {
  days: TrainingDay[]
  exercises: Exercise[]
  weekSets: ExerciseSet[]
}

export default function WeekPage() {
  const [data, setData] = useState<WeekData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const week = currentWeekStart()
  const today = todayDayOfWeek()

  useEffect(() => {
    let alive = true
    setError(null)
    ;(async () => {
      try {
        const [days, exercises] = await Promise.all([fetchDays(), fetchExercises()])
        const weekSets = await fetchSets(
          exercises.map(e => e.id),
          week,
          week,
        )
        if (alive) setData({ days, exercises, weekSets })
      } catch (err) {
        if (alive) setError(errorMessage(err))
      }
    })()
    return () => {
      alive = false
    }
  }, [week, reloadKey])

  async function handleSignOut() {
    if (window.confirm('Sign out of NVfit?')) await signOut()
  }

  return (
    <div className="page page--tabs">
      <header className="top">
        <div className="brand">
          <Logo size={32} />
          <span className="brand-word">
            NV<b>fit</b>
          </span>
        </div>
        <button type="button" className="icon-btn" onClick={handleSignOut} aria-label="Sign out" title="Sign out">
          <LogOut />
        </button>
      </header>

      <OfflineBanner />

      <p className="eyebrow">{formatWeekRange(week)}</p>
      <h1 className="h1">Your week</h1>

      {error && <ErrorState message={error} onRetry={() => setReloadKey(k => k + 1)} />}
      {!data && !error && <Loading />}

      {data && (
        <ul className="day-list">
          {data.days.map(day => {
            const dayExercises = data.exercises.filter(e => e.day_id === day.id)
            const count = dayExercises.length
            const done = dayExercises.filter(e => data.weekSets.some(s => s.exercise_id === e.id && hasValues(s))).length
            const isToday = day.day_of_week === today
            const classes = ['day-card', isToday && 'is-today', count === 0 && 'is-rest'].filter(Boolean).join(' ')

            return (
              <li key={day.id}>
                <Link to={`/day/${day.day_of_week}`} className={classes}>
                  <span className="day-card__dow">{DAY_SHORT[day.day_of_week - 1]}</span>
                  <span className="day-card__body">
                    <span className="day-card__title">
                      {day.title || (count > 0 ? DAY_NAMES[day.day_of_week - 1] : 'Rest day')}
                    </span>
                    <span className="day-card__meta">
                      {count === 0 ? 'Add exercises' : `${count} ${plural(count, 'exercise')}`}
                      {count > 0 && done > 0 && (
                        <span
                          className={`progress-pill${done === count ? ' is-complete' : ''}`}
                          aria-label={`Logged ${done} of ${count} this week`}
                        >
                          {done === count && <Check />}
                          {done}/{count}
                        </span>
                      )}
                    </span>
                  </span>
                  {isToday && <span className="badge">Today</span>}
                  <ChevronRight />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <TabBar />
    </div>
  )
}

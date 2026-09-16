import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Delta from '../components/Delta'
import { ChevronRight, Logo } from '../components/Icons'
import Sparkline from '../components/Sparkline'
import { ErrorState, Loading, OfflineBanner } from '../components/Status'
import TabBar from '../components/TabBar'
import { fetchDays, fetchExercises, fetchSummaries } from '../lib/api'
import { errorMessage } from '../lib/format'
import { METRICS, availableMetrics, metricSeries } from '../lib/metrics'
import { DAY_NAMES, DAY_SHORT, addWeeks, currentWeekStart, formatShortDate } from '../lib/weeks'
import type { Exercise, TrainingDay, WeeklySummary } from '../types'

const RANGE_WEEKS = 12

type ProgressData = {
  days: TrainingDay[]
  exercises: Exercise[]
  summaries: WeeklySummary[]
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setError(null)
    const from = addWeeks(currentWeekStart(), -(RANGE_WEEKS - 1))
    Promise.all([fetchDays(), fetchExercises(), fetchSummaries(from)])
      .then(([days, exercises, summaries]) => {
        if (alive) setData({ days, exercises, summaries })
      })
      .catch(err => {
        if (alive) setError(errorMessage(err))
      })
    return () => {
      alive = false
    }
  }, [reloadKey])

  const groups = data
    ? data.days.map(day => ({ day, exercises: data.exercises.filter(e => e.day_id === day.id) })).filter(g => g.exercises.length > 0)
    : []

  return (
    <div className="page page--tabs">
      <header className="top">
        <div className="brand">
          <Logo size={32} />
          <span className="brand-word">
            NV<b>fit</b>
          </span>
        </div>
      </header>

      <OfflineBanner />

      <p className="eyebrow">Last {RANGE_WEEKS} weeks</p>
      <h1 className="h1">Progress</h1>

      {error && <ErrorState message={error} onRetry={() => setReloadKey(k => k + 1)} />}
      {!data && !error && <Loading />}

      {data && groups.length === 0 && (
        <div className="empty">
          <p>No exercises yet. Add them to your weekly plan and your progress shows up here.</p>
          <Link className="btn btn--accent" to="/">
            Go to the weekly plan
          </Link>
        </div>
      )}

      {data &&
        groups.map(({ day, exercises }) => (
          <section key={day.id} className="group">
            <h2 className="group__title">
              {DAY_SHORT[day.day_of_week - 1]} · {day.title || DAY_NAMES[day.day_of_week - 1]}
            </h2>
            <ul className="progress-list">
              {exercises.map(exercise => {
                const rows = data.summaries.filter(s => s.exercise_id === exercise.id)
                const metric = availableMetrics(rows)[0]
                const definition = METRICS[metric]
                const series = metricSeries(rows, metric)
                const last = series.at(-1)
                const previous = series.at(-2)

                return (
                  <li key={exercise.id}>
                    <Link to={`/progress/${exercise.id}`} className="progress-row">
                      <span className="progress-row__body">
                        <span className="progress-row__name">{exercise.name}</span>
                        <span className="progress-row__meta">
                          {last ? `${definition.format(last.value)} · ${formatShortDate(last.row.week_start)}` : 'Nothing logged yet'}
                        </span>
                      </span>
                      <span className="progress-row__trend">
                        <Sparkline values={series.map(p => p.value)} />
                        {last && previous && <Delta value={last.value - previous.value} format={definition.format} />}
                      </span>
                      <ChevronRight />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

      <TabBar />
    </div>
  )
}

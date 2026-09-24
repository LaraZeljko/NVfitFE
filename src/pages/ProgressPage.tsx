import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Delta from '../components/Delta'
import { ChevronRight, Logo } from '../components/Icons'
import Sparkline from '../components/Sparkline'
import { ErrorState, Loading, OfflineBanner } from '../components/Status'
import TabBar from '../components/TabBar'
import { fetchMovements, fetchSummaries } from '../lib/api'
import { errorMessage } from '../lib/format'
import { METRICS, availableMetrics, metricSeries } from '../lib/metrics'
import { addWeeks, currentWeekStart, formatShortDate } from '../lib/weeks'
import type { Movement, MovementSummary } from '../types'

const RANGE_WEEKS = 12

type ProgressData = {
  movements: Movement[]
  summaries: MovementSummary[]
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setError(null)
    const from = addWeeks(currentWeekStart(), -(RANGE_WEEKS - 1))
    Promise.all([fetchMovements(true), fetchSummaries(from)])
      .then(([movements, summaries]) => {
        if (alive) setData({ movements, summaries })
      })
      .catch(err => {
        if (alive) setError(errorMessage(err))
      })
    return () => {
      alive = false
    }
  }, [reloadKey])

  // Exercises with something logged come first, then the rest of the library.
  const rows = data
    ? data.movements
        .map(movement => ({ movement, summaries: data.summaries.filter(s => s.movement_id === movement.id) }))
        .filter(row => row.summaries.length > 0 || row.movement.archived_at === null)
        .sort((a, b) => b.summaries.length - a.summaries.length || a.movement.name.localeCompare(b.movement.name))
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
      <p className="muted lead">Per exercise, across every day you train it.</p>

      {error && <ErrorState message={error} onRetry={() => setReloadKey(k => k + 1)} />}
      {!data && !error && <Loading />}

      {data && rows.length === 0 && (
        <div className="empty">
          <p>No exercises yet. Add them to your library and they show up here.</p>
          <Link className="btn btn--accent" to="/exercises">
            Go to exercises
          </Link>
        </div>
      )}

      {data && rows.length > 0 && (
        <ul className="progress-list">
          {rows.map(({ movement, summaries }) => {
            const metric = availableMetrics(summaries)[0]
            const definition = METRICS[metric]
            const series = metricSeries(summaries, metric)
            const last = series.at(-1)
            const previous = series.at(-2)

            return (
              <li key={movement.id}>
                <Link to={`/exercises/${movement.id}`} className="progress-row">
                  <span className="progress-row__body">
                    <span className="progress-row__name">{movement.name}</span>
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
      )}

      <TabBar />
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Delta from '../components/Delta'
import { ChevronLeft } from '../components/Icons'
import LineChart from '../components/LineChart'
import { ErrorState, Loading, OfflineBanner } from '../components/Status'
import { fetchMovementSets, fetchMovements, fetchSummaries } from '../lib/api'
import { errorMessage, formatNumber, formatSet, hasValues, plural } from '../lib/format'
import { METRICS, availableMetrics, metricSeries } from '../lib/metrics'
import type { Metric, MetricPoint } from '../lib/metrics'
import { addWeeks, currentWeekStart, formatShortDate, formatWeekRange, weeksBetween } from '../lib/weeks'
import type { ExerciseSet, Movement, MovementSummary } from '../types'

const RANGE_WEEKS = 26

type DetailData = {
  movement: Movement
  summaries: MovementSummary[]
  sets: ExerciseSet[]
  from: string
}

/** How often each weight was lifted — "how many times I lift which weight". */
type WeightRow = { weight: number; sets: number; reps: number; lastWeek: string }

function weightBreakdown(sets: ExerciseSet[]): WeightRow[] {
  const map = new Map<number, WeightRow>()
  for (const set of sets) {
    if (set.weight_kg === null) continue
    const row = map.get(set.weight_kg) ?? { weight: set.weight_kg, sets: 0, reps: 0, lastWeek: set.week_start }
    row.sets += 1
    row.reps += set.reps ?? 0
    if (set.week_start > row.lastWeek) row.lastWeek = set.week_start
    map.set(set.weight_kg, row)
  }
  return [...map.values()].sort((a, b) => b.weight - a.weight)
}

export default function MovementProgressPage() {
  const { movementId = '' } = useParams()
  const [data, setData] = useState<DetailData | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [metric, setMetric] = useState<Metric | null>(null)

  useEffect(() => {
    let alive = true
    setError(null)
    ;(async () => {
      try {
        const to = currentWeekStart()
        const from = addWeeks(to, -(RANGE_WEEKS - 1))
        const [movements, summaries, sets] = await Promise.all([
          fetchMovements(true),
          fetchSummaries(from, movementId),
          fetchMovementSets(movementId, from, to),
        ])
        const movement = movements.find(m => m.id === movementId)
        if (!movement) {
          if (alive) setMissing(true)
          return
        }
        if (alive) setData({ movement, summaries, sets, from })
      } catch (err) {
        if (alive) setError(errorMessage(err))
      }
    })()
    return () => {
      alive = false
    }
  }, [movementId, reloadKey])

  const breakdown = useMemo(() => (data ? weightBreakdown(data.sets) : []), [data])

  if (missing) return <Navigate to="/exercises" replace />

  const header = (
    <header className="top top--sticky">
      <Link to="/exercises" className="icon-btn" aria-label="Back to your exercises">
        <ChevronLeft />
      </Link>
      <span className="top__title">Exercise</span>
      <span className="icon-btn icon-btn--placeholder" aria-hidden="true" />
    </header>
  )

  if (!data) {
    return (
      <div className="page">
        {header}
        {error ? <ErrorState message={error} onRetry={() => setReloadKey(k => k + 1)} /> : <Loading />}
      </div>
    )
  }

  const metrics = availableMetrics(data.summaries)
  const active = metric && metrics.includes(metric) ? metric : metrics[0]
  const definition = METRICS[active]
  const series = metricSeries(data.summaries, active)
  const last = series.at(-1)
  const previous = series.at(-2)
  const best = series.reduce<MetricPoint | undefined>((top, point) => (!top || point.value > top.value ? point : top), undefined)
  const history = [...series].reverse()
  const points = series.map(point => ({
    key: point.row.week_start,
    x: weeksBetween(data.from, point.row.week_start),
    value: point.value,
    label: formatWeekRange(point.row.week_start),
    axisLabel: formatShortDate(point.row.week_start),
  }))
  const daysUsed = [...new Set(data.sets.map(s => s.day_id).filter(Boolean))].length

  return (
    <div className="page">
      {header}
      <OfflineBanner />

      <h1 className="h1">{data.movement.name}</h1>
      <p className="muted lead">
        Everything logged for this exercise, on every day of the week it appears
        {daysUsed > 1 ? ` (${daysUsed} different days)` : ''}.
      </p>

      {!last ? (
        <div className="empty">
          <p>Nothing logged for this exercise yet.</p>
          <Link className="btn btn--accent" to="/">
            Go to your week
          </Link>
        </div>
      ) : (
        <>
          {metrics.length > 1 && (
            <div className="segmented" role="group" aria-label="Progress metric">
              {metrics.map(m => (
                <button key={m} type="button" className="segmented__btn" aria-pressed={m === active} onClick={() => setMetric(m)}>
                  {METRICS[m].short}
                </button>
              ))}
            </div>
          )}

          <div className="stats">
            <div className="stat">
              <span className="stat__label">Last week trained</span>
              <span className="stat__value">{definition.format(last.value)}</span>
              <span className="stat__meta">
                {previous ? (
                  <>
                    <Delta value={last.value - previous.value} format={definition.format} />
                    <span>vs {formatShortDate(previous.row.week_start)}</span>
                  </>
                ) : (
                  formatShortDate(last.row.week_start)
                )}
              </span>
            </div>
            {best && (
              <div className="stat">
                <span className="stat__label">Best</span>
                <span className="stat__value">{definition.format(best.value)}</span>
                <span className="stat__meta">{formatShortDate(best.row.week_start)}</span>
              </div>
            )}
          </div>

          <section className="card">
            <h2 className="card__title">{definition.label}</h2>
            <p className="card__sub">Last {RANGE_WEEKS} weeks · tap the chart for details</p>
            {points.length >= 2 ? (
              <LineChart
                points={points}
                formatValue={definition.format}
                ariaLabel={`${definition.label} for ${data.movement.name} across ${points.length} weeks. All values are in the tables below.`}
              />
            ) : (
              <p className="muted">The chart appears once you have logged at least two weeks.</p>
            )}
          </section>

          <section className="card">
            <h2 className="card__title">By weight</h2>
            <p className="card__sub">How often each weight was lifted</p>
            <div className="table-scroll">
              <table className="history">
                <thead>
                  <tr>
                    <th scope="col">Weight</th>
                    <th scope="col" className="num">
                      Sets
                    </th>
                    <th scope="col" className="num">
                      Total reps
                    </th>
                    <th scope="col">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map(row => (
                    <tr key={row.weight}>
                      <th scope="row">{formatNumber(row.weight)} kg</th>
                      <td className="num">{row.sets}</td>
                      <td className="num">{row.reps}</td>
                      <td>{formatShortDate(row.lastWeek)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">Week by week</h2>
            <div className="table-scroll">
              <table className="history">
                <thead>
                  <tr>
                    <th scope="col">Week</th>
                    <th scope="col">Sets</th>
                    <th scope="col" className="num">
                      {definition.short}
                    </th>
                    <th scope="col" className="num">
                      Change
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((point, i) => {
                    const older = history[i + 1]
                    const weekSets = data.sets.filter(s => s.week_start === point.row.week_start && hasValues(s))
                    return (
                      <tr key={point.row.week_start}>
                        <th scope="row">
                          {formatShortDate(point.row.week_start)}
                          {point.row.day_count > 1 && (
                            <span className="muted"> · {point.row.day_count} {plural(point.row.day_count, 'day')}</span>
                          )}
                        </th>
                        <td className="history__sets">{weekSets.map(formatSet).join(' · ')}</td>
                        <td className="num">{definition.format(point.value)}</td>
                        <td className="num">{older ? <Delta value={point.value - older.value} format={definition.format} /> : '–'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

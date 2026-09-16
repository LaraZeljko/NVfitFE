import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Delta from '../components/Delta'
import { ChevronLeft } from '../components/Icons'
import LineChart from '../components/LineChart'
import { ErrorState, Loading, OfflineBanner } from '../components/Status'
import { fetchDays, fetchExercise, fetchSets, fetchSummaries } from '../lib/api'
import { errorMessage, formatSet, hasValues } from '../lib/format'
import { METRICS, availableMetrics, metricSeries } from '../lib/metrics'
import type { Metric, MetricPoint } from '../lib/metrics'
import { DAY_NAMES, addWeeks, currentWeekStart, formatShortDate, formatWeekRange, weeksBetween } from '../lib/weeks'
import type { Exercise, ExerciseSet, TrainingDay, WeeklySummary } from '../types'

const RANGE_WEEKS = 26

type DetailData = {
  exercise: Exercise
  day: TrainingDay | null
  summaries: WeeklySummary[]
  sets: ExerciseSet[]
  from: string
}

export default function ExerciseProgressPage() {
  const { exerciseId = '' } = useParams()
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
        const exercise = await fetchExercise(exerciseId)
        if (!exercise) {
          if (alive) setMissing(true)
          return
        }
        const [days, summaries, sets] = await Promise.all([fetchDays(), fetchSummaries(from, exerciseId), fetchSets([exerciseId], from, to)])
        if (alive) setData({ exercise, day: days.find(d => d.id === exercise.day_id) ?? null, summaries, sets, from })
      } catch (err) {
        if (alive) setError(errorMessage(err))
      }
    })()
    return () => {
      alive = false
    }
  }, [exerciseId, reloadKey])

  if (missing) return <Navigate to="/progress" replace />

  const header = (
    <header className="top top--sticky">
      <Link to="/progress" className="icon-btn" aria-label="Back to progress">
        <ChevronLeft />
      </Link>
      <span className="top__title">{data?.day ? data.day.title || DAY_NAMES[data.day.day_of_week - 1] : 'Progress'}</span>
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

  return (
    <div className="page">
      {header}
      <OfflineBanner />

      <h1 className="h1">{data.exercise.name}</h1>

      {!last ? (
        <div className="empty">
          <p>No sets logged for this exercise yet.</p>
          <Link className="btn btn--accent" to={data.day ? `/day/${data.day.day_of_week}` : '/'}>
            Log a workout
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
              <span className="stat__label">Last time</span>
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
                ariaLabel={`${definition.label} for ${data.exercise.name} across ${points.length} weeks. All values are in the table below.`}
              />
            ) : (
              <p className="muted">The chart appears once you have logged at least two weeks.</p>
            )}
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
                        <th scope="row">{formatShortDate(point.row.week_start)}</th>
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

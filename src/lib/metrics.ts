import type { MovementSummary } from '../types'
import { formatNumber } from './format'

export type Metric = 'weight' | 'volume' | 'reps'

type MetricDefinition = {
  label: string
  short: string
  value: (row: MovementSummary) => number | null
  format: (value: number) => string
}

export const METRICS: Record<Metric, MetricDefinition> = {
  weight: {
    label: 'Top weight',
    short: 'Weight',
    value: row => row.top_weight_kg,
    format: value => `${formatNumber(value)} kg`,
  },
  volume: {
    label: 'Volume (kg × reps)',
    short: 'Volume',
    value: row => (row.top_weight_kg === null ? null : row.volume_kg),
    format: value => `${formatNumber(Math.round(value))} kg`,
  },
  reps: {
    label: 'Total reps',
    short: 'Reps',
    value: row => row.total_reps,
    format: value => `${formatNumber(value)} reps`,
  },
}

/** Bodyweight exercises (e.g. pull-ups) are tracked by reps only. */
export function availableMetrics(rows: MovementSummary[]): Metric[] {
  return rows.some(row => (row.top_weight_kg ?? 0) > 0) ? ['weight', 'volume', 'reps'] : ['reps']
}

export type MetricPoint = { row: MovementSummary; value: number }

export function metricSeries(rows: MovementSummary[], metric: Metric): MetricPoint[] {
  const { value } = METRICS[metric]
  return rows.flatMap(row => {
    const v = value(row)
    return v === null ? [] : [{ row, value: v }]
  })
}

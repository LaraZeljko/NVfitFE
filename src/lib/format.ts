import type { SetValues } from '../types'

const displayFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })
const inputFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2, useGrouping: false })

export function formatNumber(value: number) {
  return displayFormat.format(value)
}

export function formatInputNumber(value: number | null) {
  return value === null ? '' : inputFormat.format(value)
}

/** Empty field -> null, invalid input -> undefined. Accepts both "62,5" and "62.5". */
export function parseWeight(text: string): number | null | undefined {
  const normalized = text.trim().replace(',', '.')
  if (normalized === '') return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0 || value > 1000) return undefined
  return Math.round(value * 100) / 100
}

export function parseReps(text: string): number | null | undefined {
  const normalized = text.trim()
  if (normalized === '') return null
  const value = Number(normalized)
  if (!Number.isInteger(value) || value < 0 || value > 1000) return undefined
  return value
}

export function hasValues(set: SetValues) {
  return set.weight_kg !== null || set.reps !== null
}

export function formatSet({ weight_kg, reps }: SetValues) {
  if (weight_kg !== null && reps !== null) return `${formatNumber(weight_kg)}×${reps}`
  if (weight_kg !== null) return `${formatNumber(weight_kg)} kg`
  if (reps !== null) return `${reps} reps`
  return '–'
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm
}

export function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (/failed to fetch|networkerror|load failed/i.test(message)) return 'No connection to the server. Check your internet.'
  return message || 'Something went wrong.'
}

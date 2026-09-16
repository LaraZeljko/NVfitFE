import { supabase } from './supabase'
import type { Exercise, ExerciseSet, SetValues, TrainingDay, WeeklySummary } from '../types'

type Response<T> = { data: T | null; error: { message: string } | null }

function unwrap<T>({ data, error }: Response<T>): T {
  if (error) throw new Error(error.message)
  return data as T
}

const DAY_COLUMNS = 'id, day_of_week, title'
const EXERCISE_COLUMNS = 'id, day_id, name, position'
const SET_COLUMNS = 'id, exercise_id, week_start, set_number, weight_kg, reps'
const SUMMARY_COLUMNS = 'exercise_id, week_start, sets_count, top_weight_kg, volume_kg, total_reps'
const SET_CONFLICT = 'exercise_id,week_start,set_number'

const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value))

function normalizeSet(row: ExerciseSet): ExerciseSet {
  return { ...row, weight_kg: toNumber(row.weight_kg), reps: toNumber(row.reps) }
}

function normalizeSummary(row: WeeklySummary): WeeklySummary {
  return {
    ...row,
    sets_count: Number(row.sets_count),
    top_weight_kg: toNumber(row.top_weight_kg),
    volume_kg: Number(row.volume_kg),
    total_reps: Number(row.total_reps),
  }
}

// ---- Days ----

export async function fetchDays(): Promise<TrainingDay[]> {
  const days = unwrap<TrainingDay[]>(await supabase.from('training_days').select(DAY_COLUMNS).order('day_of_week'))
  if (days.length === 7) return days

  // Fallback for accounts created before the auth trigger existed.
  const missing = [1, 2, 3, 4, 5, 6, 7]
    .filter(dow => !days.some(day => day.day_of_week === dow))
    .map(day_of_week => ({ day_of_week }))
  unwrap(await supabase.from('training_days').upsert(missing, { onConflict: 'user_id,day_of_week', ignoreDuplicates: true }))
  return unwrap<TrainingDay[]>(await supabase.from('training_days').select(DAY_COLUMNS).order('day_of_week'))
}

export async function updateDayTitle(dayId: string, title: string) {
  unwrap(await supabase.from('training_days').update({ title }).eq('id', dayId))
}

// ---- Exercises ----

export async function fetchExercises(dayId?: string): Promise<Exercise[]> {
  const query = supabase.from('exercises').select(EXERCISE_COLUMNS)
  const filtered = dayId ? query.eq('day_id', dayId) : query
  return unwrap<Exercise[]>(await filtered.order('position').order('created_at'))
}

export async function fetchExercise(exerciseId: string): Promise<Exercise | null> {
  return unwrap<Exercise | null>(await supabase.from('exercises').select(EXERCISE_COLUMNS).eq('id', exerciseId).maybeSingle())
}

export async function addExercise(dayId: string, name: string, position: number): Promise<Exercise> {
  return unwrap<Exercise>(
    await supabase.from('exercises').insert({ day_id: dayId, name, position }).select(EXERCISE_COLUMNS).single(),
  )
}

export async function renameExercise(exerciseId: string, name: string) {
  unwrap(await supabase.from('exercises').update({ name }).eq('id', exerciseId))
}

export async function setExercisePosition(exerciseId: string, position: number) {
  unwrap(await supabase.from('exercises').update({ position }).eq('id', exerciseId))
}

export async function deleteExercise(exerciseId: string) {
  unwrap(await supabase.from('exercises').delete().eq('id', exerciseId))
}

// ---- Sets ----

export async function fetchSets(exerciseIds: string[], fromWeek: string, toWeek: string): Promise<ExerciseSet[]> {
  if (exerciseIds.length === 0) return []
  const rows = unwrap<ExerciseSet[]>(
    await supabase
      .from('exercise_sets')
      .select(SET_COLUMNS)
      .in('exercise_id', exerciseIds)
      .gte('week_start', fromWeek)
      .lte('week_start', toWeek)
      .order('week_start')
      .order('set_number'),
  )
  return rows.map(normalizeSet)
}

/** Adds an empty set. Returns null if it already exists (double tap). */
export async function addSet(exerciseId: string, weekStart: string, setNumber: number): Promise<ExerciseSet | null> {
  const rows = unwrap<ExerciseSet[]>(
    await supabase
      .from('exercise_sets')
      .upsert({ exercise_id: exerciseId, week_start: weekStart, set_number: setNumber }, { onConflict: SET_CONFLICT, ignoreDuplicates: true })
      .select(SET_COLUMNS),
  )
  return rows[0] ? normalizeSet(rows[0]) : null
}

export async function saveSet(exerciseId: string, weekStart: string, setNumber: number, values: SetValues): Promise<ExerciseSet> {
  const row = unwrap<ExerciseSet>(
    await supabase
      .from('exercise_sets')
      .upsert({ exercise_id: exerciseId, week_start: weekStart, set_number: setNumber, ...values }, { onConflict: SET_CONFLICT })
      .select(SET_COLUMNS)
      .single(),
  )
  return normalizeSet(row)
}

type NewSet = Pick<ExerciseSet, 'exercise_id' | 'week_start' | 'set_number'> & SetValues

export async function saveSets(rows: NewSet[]): Promise<ExerciseSet[]> {
  const saved = unwrap<ExerciseSet[]>(await supabase.from('exercise_sets').upsert(rows, { onConflict: SET_CONFLICT }).select(SET_COLUMNS))
  return saved.map(normalizeSet)
}

/** Deletes a set and shifts the following ones down, so they stay 1, 2, 3... */
export async function deleteSet(exerciseId: string, weekStart: string, setNumber: number, lastSetNumber: number) {
  unwrap(
    await supabase
      .from('exercise_sets')
      .delete()
      .eq('exercise_id', exerciseId)
      .eq('week_start', weekStart)
      .eq('set_number', setNumber),
  )
  for (let n = setNumber + 1; n <= lastSetNumber; n++) {
    unwrap(
      await supabase
        .from('exercise_sets')
        .update({ set_number: n - 1 })
        .eq('exercise_id', exerciseId)
        .eq('week_start', weekStart)
        .eq('set_number', n),
    )
  }
}

// ---- Progress ----

export async function fetchSummaries(fromWeek: string, exerciseId?: string): Promise<WeeklySummary[]> {
  const query = supabase.from('exercise_weekly_summary').select(SUMMARY_COLUMNS).gte('week_start', fromWeek)
  const filtered = exerciseId ? query.eq('exercise_id', exerciseId) : query
  const rows = unwrap<WeeklySummary[]>(await filtered.order('week_start'))
  return rows.map(normalizeSummary)
}

// ---- Account ----

export async function signOut() {
  if ('caches' in window) await caches.delete('supabase-data').catch(() => false)
  await supabase.auth.signOut()
}

import { supabase } from './supabase'
import type {
  AdminTarget,
  BodyEntry,
  BodyValues,
  CatalogExercise,
  DayNote,
  Exercise,
  ExerciseNote,
  ExerciseSet,
  LoveMessage,
  SetValues,
  StreakImage,
  StreakState,
  TrainingDay,
  UserSettings,
  WeeklySummary,
  WorkoutSession,
} from '../types'

type Response<T> = { data: T | null; error: { message: string } | null }

function unwrap<T>({ data, error }: Response<T>): T {
  if (error) throw new Error(error.message)
  return data as T
}

const DAY_COLUMNS = 'id, day_of_week, title'
const EXERCISE_COLUMNS = 'id, day_id, name, position'
const SET_COLUMNS = 'id, exercise_id, week_start, set_number, weight_kg, reps'
const SUMMARY_COLUMNS = 'exercise_id, week_start, sets_count, top_weight_kg, volume_kg, total_reps'
const SETTINGS_COLUMNS = 'user_id, set_seconds, rest_seconds, cute_mode'
const BODY_COLUMNS = 'id, entry_date, weight_kg, calories, protein_g, note'
const MESSAGE_COLUMNS = 'id, target_user_id, day_of_week, show_date, body, is_active'
const IMAGE_COLUMNS = 'id, target_user_id, state, storage_path, caption'
const SET_CONFLICT = 'exercise_id,week_start,set_number'
const IMAGE_BUCKET = 'nvfit-images'

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

function normalizeBody(row: BodyEntry): BodyEntry {
  return {
    ...row,
    weight_kg: toNumber(row.weight_kg),
    calories: toNumber(row.calories),
    protein_g: toNumber(row.protein_g),
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

export async function fetchCatalog(): Promise<CatalogExercise[]> {
  return unwrap<CatalogExercise[]>(await supabase.from('exercise_catalog').select('id, name, muscle_group').order('name'))
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

// ---- Notes ----

export async function fetchExerciseNotes(exerciseIds: string[], weekStart: string): Promise<ExerciseNote[]> {
  if (exerciseIds.length === 0) return []
  return unwrap<ExerciseNote[]>(
    await supabase.from('exercise_notes').select('id, exercise_id, week_start, note').in('exercise_id', exerciseIds).eq('week_start', weekStart),
  )
}

export async function saveExerciseNote(exerciseId: string, weekStart: string, note: string) {
  if (note.trim() === '') {
    unwrap(await supabase.from('exercise_notes').delete().eq('exercise_id', exerciseId).eq('week_start', weekStart))
    return null
  }
  return unwrap<ExerciseNote>(
    await supabase
      .from('exercise_notes')
      .upsert({ exercise_id: exerciseId, week_start: weekStart, note }, { onConflict: 'exercise_id,week_start' })
      .select('id, exercise_id, week_start, note')
      .single(),
  )
}

export async function fetchDayNote(dayId: string, weekStart: string): Promise<DayNote | null> {
  return unwrap<DayNote | null>(
    await supabase.from('day_notes').select('id, day_id, week_start, note').eq('day_id', dayId).eq('week_start', weekStart).maybeSingle(),
  )
}

export async function saveDayNote(dayId: string, weekStart: string, note: string) {
  if (note.trim() === '') {
    unwrap(await supabase.from('day_notes').delete().eq('day_id', dayId).eq('week_start', weekStart))
    return null
  }
  return unwrap<DayNote>(
    await supabase
      .from('day_notes')
      .upsert({ day_id: dayId, week_start: weekStart, note }, { onConflict: 'day_id,week_start' })
      .select('id, day_id, week_start, note')
      .single(),
  )
}

// ---- Settings ----

export async function fetchSettings(userId: string): Promise<UserSettings> {
  const existing = unwrap<UserSettings | null>(await supabase.from('user_settings').select(SETTINGS_COLUMNS).maybeSingle())
  if (existing) return existing
  // Accounts created before the settings table existed.
  return unwrap<UserSettings>(
    await supabase.from('user_settings').upsert({ user_id: userId }, { onConflict: 'user_id' }).select(SETTINGS_COLUMNS).single(),
  )
}

export async function saveSettings(userId: string, values: Partial<Pick<UserSettings, 'set_seconds' | 'rest_seconds'>>) {
  unwrap(await supabase.from('user_settings').update(values).eq('user_id', userId))
}

// ---- Body and nutrition ----

export async function fetchBodyEntries(fromDate: string, toDate: string): Promise<BodyEntry[]> {
  const rows = unwrap<BodyEntry[]>(
    await supabase.from('body_entries').select(BODY_COLUMNS).gte('entry_date', fromDate).lte('entry_date', toDate).order('entry_date'),
  )
  return rows.map(normalizeBody)
}

export async function saveBodyEntry(entryDate: string, values: BodyValues): Promise<BodyEntry> {
  const row = unwrap<BodyEntry>(
    await supabase
      .from('body_entries')
      .upsert({ entry_date: entryDate, ...values }, { onConflict: 'user_id,entry_date' })
      .select(BODY_COLUMNS)
      .single(),
  )
  return normalizeBody(row)
}

export async function deleteBodyEntry(entryDate: string) {
  unwrap(await supabase.from('body_entries').delete().eq('entry_date', entryDate))
}

// ---- Streak ----

export async function fetchSessions(fromDate: string): Promise<WorkoutSession[]> {
  return unwrap<WorkoutSession[]>(
    await supabase.from('workout_sessions').select('session_date, day_id').gte('session_date', fromDate).order('session_date'),
  )
}

/** Marks today as trained. Safe to call repeatedly. */
export async function logSession(sessionDate: string, dayId: string) {
  unwrap(
    await supabase
      .from('workout_sessions')
      .upsert({ session_date: sessionDate, day_id: dayId }, { onConflict: 'user_id,session_date', ignoreDuplicates: true }),
  )
}

// ---- Admin: messages and images for someone else's app ----

export async function fetchIsAdmin(userId: string): Promise<boolean> {
  const row = unwrap<{ user_id: string } | null>(await supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle())
  return row !== null
}

export async function fetchAdminTargets(): Promise<AdminTarget[]> {
  return unwrap<AdminTarget[]>(await supabase.from('admin_targets').select('admin_id, target_user_id, display_name'))
}

export async function fetchMessages(targetUserId: string): Promise<LoveMessage[]> {
  return unwrap<LoveMessage[]>(
    await supabase.from('love_messages').select(MESSAGE_COLUMNS).eq('target_user_id', targetUserId).order('day_of_week', { nullsFirst: false }),
  )
}

/** What the target's app reads: only the active messages meant for them. */
export async function fetchMyMessages(): Promise<LoveMessage[]> {
  return unwrap<LoveMessage[]>(await supabase.from('love_messages').select(MESSAGE_COLUMNS).eq('is_active', true))
}

export async function addMessage(
  targetUserId: string,
  body: string,
  options: { day_of_week?: number | null; show_date?: string | null } = {},
): Promise<LoveMessage> {
  return unwrap<LoveMessage>(
    await supabase
      .from('love_messages')
      .insert({
        target_user_id: targetUserId,
        body,
        day_of_week: options.day_of_week ?? null,
        show_date: options.show_date ?? null,
      })
      .select(MESSAGE_COLUMNS)
      .single(),
  )
}

export async function updateMessage(id: string, values: Partial<Pick<LoveMessage, 'body' | 'day_of_week' | 'show_date' | 'is_active'>>) {
  unwrap(await supabase.from('love_messages').update(values).eq('id', id))
}

export async function deleteMessage(id: string) {
  unwrap(await supabase.from('love_messages').delete().eq('id', id))
}

export async function fetchStreakImages(targetUserId?: string): Promise<StreakImage[]> {
  const query = supabase.from('streak_images').select(IMAGE_COLUMNS)
  const filtered = targetUserId ? query.eq('target_user_id', targetUserId) : query
  return unwrap<StreakImage[]>(await filtered.order('created_at'))
}

/** Uploads the picture into the private bucket and records it. */
export async function uploadStreakImage(targetUserId: string, state: StreakState, file: File, caption: string | null): Promise<StreakImage> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${targetUserId}/${state}-${Date.now()}.${extension}`
  const upload = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { upsert: false })
  if (upload.error) throw new Error(upload.error.message)

  try {
    return unwrap<StreakImage>(
      await supabase
        .from('streak_images')
        .insert({ target_user_id: targetUserId, state, storage_path: path, caption })
        .select(IMAGE_COLUMNS)
        .single(),
    )
  } catch (error) {
    // Do not leave an orphaned file behind if the row could not be written.
    await supabase.storage.from(IMAGE_BUCKET).remove([path])
    throw error
  }
}

export async function deleteStreakImage(image: StreakImage) {
  unwrap(await supabase.from('streak_images').delete().eq('id', image.id))
  await supabase.storage.from(IMAGE_BUCKET).remove([image.storage_path])
}

/** The bucket is private, so pictures are read through a short-lived signed link. */
export async function signImageUrl(storagePath: string, seconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(storagePath, seconds)
  if (error) return null
  return data?.signedUrl ?? null
}

// ---- Account ----

export async function signOut() {
  if ('caches' in window) await caches.delete('supabase-data').catch(() => false)
  await supabase.auth.signOut()
}

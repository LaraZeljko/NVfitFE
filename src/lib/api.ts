import { supabase } from './supabase'
import type {
  BodyEntry,
  BodyValues,
  CatalogExercise,
  Connection,
  DayNote,
  Exercise,
  ExerciseNote,
  ExerciseSet,
  LoveMessage,
  Movement,
  MovementSummary,
  ProgressPhoto,
  SetValues,
  StreakImage,
  StreakState,
  TrainingDay,
  UserSettings,
  WorkoutSession,
} from '../types'

type Response<T> = { data: T | null; error: { message: string } | null }

function unwrap<T>({ data, error }: Response<T>): T {
  if (error) throw new Error(error.message)
  return data as T
}

const DAY_COLUMNS = 'id, day_of_week, title'
const MOVEMENT_COLUMNS = 'id, name, muscle_group, is_favourite, archived_at'
const EXERCISE_COLUMNS = 'id, day_id, movement_id, name, position'
const SET_COLUMNS = 'id, exercise_id, movement_id, day_id, week_start, set_number, weight_kg, reps'
const SUMMARY_COLUMNS = 'movement_id, week_start, sets_count, day_count, top_weight_kg, volume_kg, total_reps'
const SETTINGS_COLUMNS = 'user_id, set_seconds, rest_seconds, cute_mode'
const BODY_COLUMNS = 'id, entry_date, weight_kg, calories, protein_g, note'
const PHOTO_COLUMNS = 'id, taken_on, storage_path, note, weight_kg'
const CONNECTION_COLUMNS = 'id, requester_id, addressee_id, status, requester_label, addressee_label, created_at'
const MESSAGE_COLUMNS = 'id, target_user_id, day_of_week, show_date, body, is_active'
const IMAGE_COLUMNS = 'id, target_user_id, state, storage_path, caption'
const SET_CONFLICT = 'exercise_id,week_start,set_number'
const IMAGE_BUCKET = 'nvfit-images'
const PHOTO_BUCKET = 'nvfit-photos'

const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value))

function normalizeSet(row: ExerciseSet): ExerciseSet {
  return { ...row, weight_kg: toNumber(row.weight_kg), reps: toNumber(row.reps) }
}

function normalizeSummary(row: MovementSummary): MovementSummary {
  return {
    ...row,
    sets_count: Number(row.sets_count),
    day_count: Number(row.day_count),
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

  const missing = [1, 2, 3, 4, 5, 6, 7]
    .filter(dow => !days.some(day => day.day_of_week === dow))
    .map(day_of_week => ({ day_of_week }))
  unwrap(await supabase.from('training_days').upsert(missing, { onConflict: 'user_id,day_of_week', ignoreDuplicates: true }))
  return unwrap<TrainingDay[]>(await supabase.from('training_days').select(DAY_COLUMNS).order('day_of_week'))
}

export async function updateDayTitle(dayId: string, title: string) {
  unwrap(await supabase.from('training_days').update({ title }).eq('id', dayId))
}

// ---- Movements (your own library) ----

export async function fetchMovements(includeArchived = false): Promise<Movement[]> {
  const query = supabase.from('movements').select(MOVEMENT_COLUMNS)
  const filtered = includeArchived ? query : query.is('archived_at', null)
  return unwrap<Movement[]>(await filtered.order('is_favourite', { ascending: false }).order('name'))
}

export async function addMovement(name: string, muscleGroup: string | null = null): Promise<Movement> {
  return unwrap<Movement>(
    await supabase.from('movements').insert({ name, muscle_group: muscleGroup }).select(MOVEMENT_COLUMNS).single(),
  )
}

/** Adds it, or returns the one already in the library with that name. */
export async function findOrAddMovement(name: string): Promise<Movement> {
  const existing = unwrap<Movement[]>(await supabase.from('movements').select(MOVEMENT_COLUMNS).ilike('name', name).limit(1))
  if (existing[0]) {
    if (existing[0].archived_at) await updateMovement(existing[0].id, { archived_at: null })
    return { ...existing[0], archived_at: null }
  }
  return addMovement(name)
}

export async function updateMovement(
  movementId: string,
  values: Partial<Pick<Movement, 'name' | 'muscle_group' | 'is_favourite' | 'archived_at'>>,
) {
  unwrap(await supabase.from('movements').update(values).eq('id', movementId))
}

/** Deletes the movement and everything ever logged under it. */
export async function deleteMovement(movementId: string) {
  unwrap(await supabase.from('movements').delete().eq('id', movementId))
}

// ---- Exercises (a movement placed in a day) ----

export async function fetchExercises(dayId?: string): Promise<Exercise[]> {
  const query = supabase.from('exercises').select(EXERCISE_COLUMNS)
  const filtered = dayId ? query.eq('day_id', dayId) : query
  return unwrap<Exercise[]>(await filtered.order('position').order('created_at'))
}

export async function addExercise(dayId: string, movement: Movement, position: number): Promise<Exercise> {
  return unwrap<Exercise>(
    await supabase
      .from('exercises')
      .insert({ day_id: dayId, movement_id: movement.id, name: movement.name, position })
      .select(EXERCISE_COLUMNS)
      .single(),
  )
}

export async function setExercisePosition(exerciseId: string, position: number) {
  unwrap(await supabase.from('exercises').update({ position }).eq('id', exerciseId))
}

/** Takes the movement out of that day. The logged sets stay in its history. */
export async function removeExerciseFromDay(exerciseId: string) {
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

/** Every set ever logged for one movement, whichever day it was done on. */
export async function fetchMovementSets(movementId: string, fromWeek: string, toWeek: string): Promise<ExerciseSet[]> {
  const rows = unwrap<ExerciseSet[]>(
    await supabase
      .from('exercise_sets')
      .select(SET_COLUMNS)
      .eq('movement_id', movementId)
      .gte('week_start', fromWeek)
      .lte('week_start', toWeek)
      .order('week_start')
      .order('set_number'),
  )
  return rows.map(normalizeSet)
}

type SetKey = { exercise: Exercise; weekStart: string; setNumber: number }

function setIdentity({ exercise, weekStart, setNumber }: SetKey) {
  return {
    exercise_id: exercise.id,
    movement_id: exercise.movement_id,
    day_id: exercise.day_id,
    week_start: weekStart,
    set_number: setNumber,
  }
}

/** Adds an empty set. Returns null if it already exists (double tap). */
export async function addSet(key: SetKey): Promise<ExerciseSet | null> {
  const rows = unwrap<ExerciseSet[]>(
    await supabase
      .from('exercise_sets')
      .upsert(setIdentity(key), { onConflict: SET_CONFLICT, ignoreDuplicates: true })
      .select(SET_COLUMNS),
  )
  return rows[0] ? normalizeSet(rows[0]) : null
}

export async function saveSet(key: SetKey, values: SetValues): Promise<ExerciseSet> {
  const row = unwrap<ExerciseSet>(
    await supabase
      .from('exercise_sets')
      .upsert({ ...setIdentity(key), ...values }, { onConflict: SET_CONFLICT })
      .select(SET_COLUMNS)
      .single(),
  )
  return normalizeSet(row)
}

export async function saveSets(rows: Array<SetKey & SetValues>): Promise<ExerciseSet[]> {
  const payload = rows.map(({ exercise, weekStart, setNumber, weight_kg, reps }) => ({
    ...setIdentity({ exercise, weekStart, setNumber }),
    weight_kg,
    reps,
  }))
  const saved = unwrap<ExerciseSet[]>(await supabase.from('exercise_sets').upsert(payload, { onConflict: SET_CONFLICT }).select(SET_COLUMNS))
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

export async function fetchSummaries(fromWeek: string, movementId?: string): Promise<MovementSummary[]> {
  const query = supabase.from('movement_weekly_summary').select(SUMMARY_COLUMNS).gte('week_start', fromWeek)
  const filtered = movementId ? query.eq('movement_id', movementId) : query
  const rows = unwrap<MovementSummary[]>(await filtered.order('week_start'))
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

// ---- Progress photos (private to you) ----

export async function fetchPhotos(): Promise<ProgressPhoto[]> {
  const rows = unwrap<ProgressPhoto[]>(await supabase.from('progress_photos').select(PHOTO_COLUMNS).order('taken_on', { ascending: false }))
  return rows.map(row => ({ ...row, weight_kg: toNumber(row.weight_kg) }))
}

export async function uploadPhoto(file: File, takenOn: string, note: string | null, weightKg: number | null): Promise<ProgressPhoto> {
  const path = `${takenOn}-${Date.now()}.jpg`
  const upload = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { upsert: false })
  if (upload.error) throw new Error(upload.error.message)
  try {
    const row = unwrap<ProgressPhoto>(
      await supabase
        .from('progress_photos')
        .insert({ taken_on: takenOn, storage_path: path, note, weight_kg: weightKg })
        .select(PHOTO_COLUMNS)
        .single(),
    )
    return { ...row, weight_kg: toNumber(row.weight_kg) }
  } catch (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path])
    throw error
  }
}

export async function deletePhoto(photo: ProgressPhoto) {
  unwrap(await supabase.from('progress_photos').delete().eq('id', photo.id))
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path])
}

export async function signPhotoUrl(storagePath: string, seconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(storagePath, seconds)
  if (error) return null
  return data?.signedUrl ?? null
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

// ---- Partner connection ----

export async function fetchConnections(): Promise<Connection[]> {
  return unwrap<Connection[]>(await supabase.from('connections').select(CONNECTION_COLUMNS).order('created_at'))
}

export async function requestConnection(email: string, label: string | null) {
  const { error } = await supabase.rpc('request_connection', { partner_email: email, my_label_for_them: label })
  if (error) throw new Error(error.message)
}

export async function respondToConnection(connectionId: string, accept: boolean, label: string | null) {
  const { error } = await supabase.rpc('respond_to_connection', {
    connection_id: connectionId,
    accept,
    my_label_for_them: label,
  })
  if (error) throw new Error(error.message)
}

export async function cancelConnection(connectionId: string) {
  unwrap(await supabase.from('connections').delete().eq('id', connectionId))
}

// ---- Messages and pictures for the person you are connected to ----

export async function fetchMessages(targetUserId: string): Promise<LoveMessage[]> {
  return unwrap<LoveMessage[]>(
    await supabase.from('love_messages').select(MESSAGE_COLUMNS).eq('target_user_id', targetUserId).order('day_of_week', { nullsFirst: false }),
  )
}

/**
 * Only the active messages written FOR you.
 * The filter matters: the access rules also hand you the messages you wrote for
 * your partner, because you are allowed to edit those.
 */
export async function fetchMyMessages(userId: string): Promise<LoveMessage[]> {
  return unwrap<LoveMessage[]>(
    await supabase.from('love_messages').select(MESSAGE_COLUMNS).eq('target_user_id', userId).eq('is_active', true),
  )
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

export async function uploadStreakImage(targetUserId: string, state: StreakState, file: File, caption: string | null): Promise<StreakImage> {
  const path = `${targetUserId}/${state}-${Date.now()}.jpg`
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
    await supabase.storage.from(IMAGE_BUCKET).remove([path])
    throw error
  }
}

export async function deleteStreakImage(image: StreakImage) {
  unwrap(await supabase.from('streak_images').delete().eq('id', image.id))
  await supabase.storage.from(IMAGE_BUCKET).remove([image.storage_path])
}

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

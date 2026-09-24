export type TrainingDay = {
  id: string
  day_of_week: number
  title: string
}

/** An exercise in your own library. Days point at these; history hangs off them. */
export type Movement = {
  id: string
  name: string
  muscle_group: string | null
  is_favourite: boolean
  archived_at: string | null
}

/** A movement placed into one day of the week. */
export type Exercise = {
  id: string
  day_id: string
  movement_id: string
  name: string
  position: number
}

export type ExerciseSet = {
  id: string
  /** null once the movement is removed from that day — the history stays. */
  exercise_id: string | null
  movement_id: string
  day_id: string | null
  week_start: string
  set_number: number
  weight_kg: number | null
  reps: number | null
}

export type SetValues = Pick<ExerciseSet, 'weight_kg' | 'reps'>

/** Per movement and week, across every day it was trained on. */
export type MovementSummary = {
  movement_id: string
  week_start: string
  sets_count: number
  day_count: number
  top_weight_kg: number | null
  volume_kg: number
  total_reps: number
}

// ---- Settings and personal log ----

export type UserSettings = {
  user_id: string
  /** 0 = the set itself is not timed */
  set_seconds: number
  rest_seconds: number
  cute_mode: boolean
}

export type BodyEntry = {
  id: string
  entry_date: string
  weight_kg: number | null
  calories: number | null
  protein_g: number | null
  note: string | null
}

export type BodyValues = Pick<BodyEntry, 'weight_kg' | 'calories' | 'protein_g' | 'note'>

export type ProgressPhoto = {
  id: string
  taken_on: string
  storage_path: string
  note: string | null
  weight_kg: number | null
}

export type ExerciseNote = {
  id: string
  exercise_id: string
  week_start: string
  note: string
}

export type DayNote = {
  id: string
  day_id: string
  week_start: string
  note: string
}

export type CatalogExercise = {
  id: string
  name: string
  muscle_group: string
}

/** One row per day on which anything was logged — the streak is counted from these. */
export type WorkoutSession = {
  session_date: string
  day_id: string | null
}

// ---- Partner connection ----

export type ConnectionStatus = 'pending' | 'accepted' | 'declined'

export type Connection = {
  id: string
  requester_id: string
  addressee_id: string
  status: ConnectionStatus
  requester_label: string | null
  addressee_label: string | null
  created_at: string
}

export type LoveMessage = {
  id: string
  target_user_id: string
  /** 1 = Monday; null when the message is not tied to a weekday */
  day_of_week: number | null
  show_date: string | null
  body: string
  is_active: boolean
}

export type StreakState = 'chill' | 'stressed' | 'angry' | 'rest' | 'celebration'

export type StreakImage = {
  id: string
  target_user_id: string
  state: StreakState
  storage_path: string
  caption: string | null
}

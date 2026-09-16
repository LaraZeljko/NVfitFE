export type TrainingDay = {
  id: string
  day_of_week: number
  title: string
}

export type Exercise = {
  id: string
  day_id: string
  name: string
  position: number
}

export type ExerciseSet = {
  id: string
  exercise_id: string
  week_start: string
  set_number: number
  weight_kg: number | null
  reps: number | null
}

export type SetValues = Pick<ExerciseSet, 'weight_kg' | 'reps'>

export type WeeklySummary = {
  exercise_id: string
  week_start: string
  sets_count: number
  top_weight_kg: number | null
  volume_kg: number
  total_reps: number
}

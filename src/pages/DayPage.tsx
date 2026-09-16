import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import DayStrip from '../components/DayStrip'
import ExerciseCard from '../components/ExerciseCard'
import type { PreviousSets } from '../components/ExerciseCard'
import { ChevronLeft, Plus } from '../components/Icons'
import { ErrorState, Loading, OfflineBanner, SaveIndicator } from '../components/Status'
import WeekSwitcher from '../components/WeekSwitcher'
import { useSaveQueue } from '../hooks/useSaveQueue'
import {
  addExercise,
  addSet,
  deleteExercise,
  deleteSet,
  fetchDays,
  fetchExercises,
  fetchSets,
  renameExercise,
  saveSet,
  saveSets,
  setExercisePosition,
  updateDayTitle,
} from '../lib/api'
import { errorMessage, hasValues } from '../lib/format'
import { DAY_NAMES, addWeeks, currentWeekStart, isValidWeekStart } from '../lib/weeks'
import type { Exercise, ExerciseSet, SetValues, TrainingDay } from '../types'

// How many weeks back we look for the "last time" values of each exercise.
const HISTORY_WEEKS = 12
const MAX_SETS = 20

const bySetNumber = (a: ExerciseSet, b: ExerciseSet) => a.set_number - b.set_number

export default function DayPage() {
  const params = useParams()
  const dow = Number(params.dow)
  const validDow = Number.isInteger(dow) && dow >= 1 && dow <= 7

  const [searchParams, setSearchParams] = useSearchParams()
  const thisWeek = currentWeekStart()
  const requestedWeek = searchParams.get('week')
  const week = isValidWeekStart(requestedWeek) && requestedWeek <= thisWeek ? requestedWeek : thisWeek

  const [day, setDay] = useState<TrainingDay | null>(null)
  const [title, setTitle] = useState('')
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [sets, setSets] = useState<ExerciseSet[]>([])
  const [setsKey, setSetsKey] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [newName, setNewName] = useState('')
  const save = useSaveQueue()

  const exercisesRef = useRef(exercises)
  exercisesRef.current = exercises

  // The day and its exercises
  useEffect(() => {
    if (!validDow) return
    let alive = true
    setDay(null)
    setExercises(null)
    setLoadError(null)
    ;(async () => {
      try {
        const days = await fetchDays()
        const found = days.find(d => d.day_of_week === dow)
        if (!found) throw new Error('Day not found.')
        const list = await fetchExercises(found.id)
        if (!alive) return
        setDay(found)
        setTitle(found.title)
        setExercises(list)
      } catch (err) {
        if (alive) setLoadError(errorMessage(err))
      }
    })()
    return () => {
      alive = false
    }
  }, [dow, validDow, reloadKey])

  // Sets for the selected week plus a few weeks back (for the "last time" hints)
  const loadedDayId = exercises ? day?.id : undefined
  useEffect(() => {
    const list = exercisesRef.current
    if (!loadedDayId || !list) return
    let alive = true
    fetchSets(
      list.map(e => e.id),
      addWeeks(week, -HISTORY_WEEKS),
      week,
    )
      .then(rows => {
        if (!alive) return
        setSets(rows)
        setSetsKey(`${loadedDayId}|${week}`)
      })
      .catch(err => {
        if (alive) setLoadError(errorMessage(err))
      })
    return () => {
      alive = false
    }
  }, [loadedDayId, week, reloadKey])

  const setsByExercise = useMemo(() => {
    const map = new Map<string, ExerciseSet[]>()
    for (const set of sets) {
      const list = map.get(set.exercise_id)
      if (list) list.push(set)
      else map.set(set.exercise_id, [set])
    }
    return map
  }, [sets])

  function currentSets(exerciseId: string) {
    return (setsByExercise.get(exerciseId) ?? []).filter(s => s.week_start === week).sort(bySetNumber)
  }

  function previousSets(exerciseId: string): PreviousSets | null {
    const past = (setsByExercise.get(exerciseId) ?? []).filter(s => s.week_start < week && hasValues(s))
    if (past.length === 0) return null
    const lastWeek = past.reduce((latest, s) => (s.week_start > latest ? s.week_start : latest), past[0].week_start)
    return { week: lastWeek, sets: past.filter(s => s.week_start === lastWeek).sort(bySetNumber) }
  }

  // ---- Sets ----

  function handleSaveSet(exerciseId: string, setNumber: number, values: SetValues) {
    const w = week
    setSets(prev =>
      prev.map(s => (s.exercise_id === exerciseId && s.week_start === w && s.set_number === setNumber ? { ...s, ...values } : s)),
    )
    void save.run(() => saveSet(exerciseId, w, setNumber, values))
  }

  async function handleAddSet(exerciseId: string) {
    const w = week
    const next = (currentSets(exerciseId).at(-1)?.set_number ?? 0) + 1
    if (next > MAX_SETS) return
    const row = await save.run(() => addSet(exerciseId, w, next))
    if (row) setSets(prev => (prev.some(s => s.id === row.id) ? prev : [...prev, row]))
  }

  function handleDeleteSet(exerciseId: string, set: ExerciseSet) {
    if (hasValues(set) && !window.confirm(`Delete set ${set.set_number}?`)) return
    const w = week
    const last = currentSets(exerciseId).at(-1)?.set_number ?? set.set_number
    setSets(prev =>
      prev
        .filter(s => s.id !== set.id)
        .map(s =>
          s.exercise_id === exerciseId && s.week_start === w && s.set_number > set.set_number ? { ...s, set_number: s.set_number - 1 } : s,
        ),
    )
    void save.run(() => deleteSet(exerciseId, w, set.set_number, last))
  }

  // Weights are copied over, reps are left empty (last time's reps show as placeholders).
  async function handleCopyPrevious(exerciseId: string) {
    const previous = previousSets(exerciseId)
    if (!previous) return
    const w = week
    const rows = await save.run(() =>
      saveSets(
        previous.sets.map((s, i) => ({ exercise_id: exerciseId, week_start: w, set_number: i + 1, weight_kg: s.weight_kg, reps: null })),
      ),
    )
    if (rows) setSets(prev => [...prev.filter(s => !(s.exercise_id === exerciseId && s.week_start === w)), ...rows])
  }

  // ---- Exercises ----

  async function handleAddExercise(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = newName.trim()
    if (!name || !day || !exercises) return
    const position = exercises.reduce((max, x) => Math.max(max, x.position), -1) + 1
    setNewName('')
    const created = await save.run(() => addExercise(day.id, name, position))
    if (created) setExercises(list => (list ? [...list, created] : [created]))
    else setNewName(name)
  }

  function handleRename(exercise: Exercise, name: string) {
    setExercises(list => list?.map(x => (x.id === exercise.id ? { ...x, name } : x)) ?? list)
    void save.run(() => renameExercise(exercise.id, name))
  }

  function handleMove(index: number, direction: -1 | 1) {
    if (!exercises) return
    const current = exercises[index]
    const other = exercises[index + direction]
    if (!current || !other) return
    const next = [...exercises]
    next[index] = { ...other, position: current.position }
    next[index + direction] = { ...current, position: other.position }
    setExercises(next)
    void save.run(async () => {
      await setExercisePosition(current.id, other.position)
      await setExercisePosition(other.id, current.position)
    })
  }

  function handleDeleteExercise(exercise: Exercise) {
    setExercises(list => list?.filter(x => x.id !== exercise.id) ?? list)
    setSets(prev => prev.filter(s => s.exercise_id !== exercise.id))
    void save.run(() => deleteExercise(exercise.id))
  }

  function handleTitleBlur() {
    if (!day) return
    const trimmed = title.trim()
    setTitle(trimmed)
    if (trimmed === day.title) return
    setDay({ ...day, title: trimmed })
    void save.run(() => updateDayTitle(day.id, trimmed))
  }

  function changeWeek(next: string) {
    setSearchParams(next === thisWeek ? {} : { week: next }, { replace: true })
  }

  function reload() {
    save.clearError()
    setReloadKey(k => k + 1)
  }

  if (!validDow) return <Navigate to="/" replace />

  const refreshing = setsKey !== `${day?.id}|${week}`

  return (
    <div className="page">
      <header className="top top--sticky">
        <Link to="/" className="icon-btn" aria-label="Back to the week">
          <ChevronLeft />
        </Link>
        <span className="top__title">{DAY_NAMES[dow - 1]}</span>
        <SaveIndicator status={save.status} />
      </header>

      <DayStrip active={dow} week={week === thisWeek ? null : week} />
      <OfflineBanner />

      {save.error && (
        <div className="banner banner--error" role="alert">
          <span>Not saved: {save.error}</span>
          <button type="button" className="btn btn--small" onClick={reload}>
            Refresh
          </button>
        </div>
      )}

      {loadError && <ErrorState message={loadError} onRetry={reload} />}
      {!exercises && !loadError && <Loading />}

      {exercises && day && (
        <>
          <input
            className="title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            placeholder="Title, e.g. Push day"
            maxLength={60}
            aria-label="Day title"
          />

          <WeekSwitcher week={week} onChange={changeWeek} />

          <div className={`exercise-list${refreshing ? ' is-refreshing' : ''}`} aria-busy={refreshing}>
            {exercises.length === 0 && (
              <p className="empty">No exercises for this day yet. Add the first one below, or keep it as a rest day.</p>
            )}
            {exercises.map((exercise, index) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                index={index}
                isFirst={index === 0}
                isLast={index === exercises.length - 1}
                sets={currentSets(exercise.id)}
                previous={previousSets(exercise.id)}
                maxSets={MAX_SETS}
                onSaveSet={(setNumber, values) => handleSaveSet(exercise.id, setNumber, values)}
                onAddSet={() => void handleAddSet(exercise.id)}
                onDeleteSet={set => handleDeleteSet(exercise.id, set)}
                onCopyPrevious={() => void handleCopyPrevious(exercise.id)}
                onRename={name => handleRename(exercise, name)}
                onMove={direction => handleMove(index, direction)}
                onDelete={() => handleDeleteExercise(exercise)}
              />
            ))}
          </div>

          <form className="add-exercise" onSubmit={handleAddExercise}>
            <input
              className="field"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={exercises.length ? 'New exercise' : 'e.g. Incline dumbbell press'}
              maxLength={80}
              aria-label="New exercise name"
            />
            <button type="submit" className="btn btn--accent" disabled={!newName.trim()}>
              <Plus /> Add
            </button>
          </form>
        </>
      )}
    </div>
  )
}

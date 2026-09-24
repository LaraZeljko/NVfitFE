import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import DayStrip from '../components/DayStrip'
import ExerciseCard from '../components/ExerciseCard'
import type { PreviousSets } from '../components/ExerciseCard'
import { ChevronLeft, Plus } from '../components/Icons'
import { ErrorState, Loading, OfflineBanner, SaveIndicator } from '../components/Status'
import TimerBar from '../components/TimerBar'
import WeekSwitcher from '../components/WeekSwitcher'
import { useSaveQueue } from '../hooks/useSaveQueue'
import { useSettings } from '../hooks/useSettings'
import { useTimer } from '../hooks/useTimer'
import {
  addExercise,
  addSet,
  deleteSet,
  fetchDayNote,
  fetchDays,
  fetchExerciseNotes,
  fetchExercises,
  fetchMovements,
  fetchSets,
  findOrAddMovement,
  logSession,
  removeExerciseFromDay,
  saveDayNote,
  saveExerciseNote,
  saveSet,
  saveSets,
  setExercisePosition,
  updateDayTitle,
  updateMovement,
} from '../lib/api'
import { errorMessage, hasValues } from '../lib/format'
import { DAY_NAMES, addWeeks, currentWeekStart, isValidWeekStart, todayISO } from '../lib/weeks'
import type { Exercise, ExerciseSet, Movement, SetValues, TrainingDay } from '../types'

// How many weeks back we look for the "last time" values of each exercise.
const HISTORY_WEEKS = 12
const MAX_SETS = 20
const LIBRARY_ID = 'movement-library'

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
  const [movements, setMovements] = useState<Movement[]>([])
  const [sets, setSets] = useState<ExerciseSet[]>([])
  const [setsKey, setSetsKey] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [dayNote, setDayNote] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [newName, setNewName] = useState('')
  const save = useSaveQueue()
  const timer = useTimer()
  const { settings } = useSettings()

  const exercisesRef = useRef(exercises)
  exercisesRef.current = exercises

  // Today's training session is written once per visit, not on every saved set.
  const sessionLoggedRef = useRef(false)

  // Your library, offered when adding to this day.
  useEffect(() => {
    let alive = true
    fetchMovements()
      .then(rows => {
        if (alive) setMovements(rows)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [reloadKey])

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

  const loadedDayId = exercises ? day?.id : undefined
  useEffect(() => {
    const list = exercisesRef.current
    if (!loadedDayId || !list) return
    let alive = true
    const ids = list.map(e => e.id)
    ;(async () => {
      try {
        const [rows, exerciseNotes, note] = await Promise.all([
          fetchSets(ids, addWeeks(week, -HISTORY_WEEKS), week),
          fetchExerciseNotes(ids, week),
          fetchDayNote(loadedDayId, week),
        ])
        if (!alive) return
        setSets(rows)
        setNotes(Object.fromEntries(exerciseNotes.map(n => [n.exercise_id, n.note])))
        setDayNote(note?.note ?? '')
        setSetsKey(`${loadedDayId}|${week}`)
      } catch (err) {
        if (alive) setLoadError(errorMessage(err))
      }
    })()
    return () => {
      alive = false
    }
  }, [loadedDayId, week, reloadKey])

  const movementById = useMemo(() => new Map(movements.map(movement => [movement.id, movement])), [movements])

  function nameOf(exercise: Exercise) {
    return movementById.get(exercise.movement_id)?.name ?? exercise.name
  }

  const setsByExercise = useMemo(() => {
    const map = new Map<string, ExerciseSet[]>()
    for (const set of sets) {
      if (!set.exercise_id) continue
      const list = map.get(set.exercise_id)
      if (list) list.push(set)
      else map.set(set.exercise_id, [set])
    }
    return map
  }, [sets])

  /** A record = this week's heaviest set beats every earlier week we loaded. */
  const records = useMemo(() => {
    const map = new Map<string, boolean>()
    const heaviest = (list: ExerciseSet[], predicate: (s: ExerciseSet) => boolean) =>
      list.reduce((top, s) => (predicate(s) && s.weight_kg !== null && s.weight_kg > top ? s.weight_kg : top), 0)
    for (const [exerciseId, list] of setsByExercise) {
      const current = heaviest(list, s => s.week_start === week)
      const before = heaviest(list, s => s.week_start < week)
      map.set(exerciseId, current > 0 && before > 0 && current > before)
    }
    return map
  }, [setsByExercise, week])

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

  function handleSaveSet(exercise: Exercise, setNumber: number, values: SetValues) {
    const w = week
    setSets(prev =>
      prev.map(s => (s.exercise_id === exercise.id && s.week_start === w && s.set_number === setNumber ? { ...s, ...values } : s)),
    )
    void save.run(() => saveSet({ exercise, weekStart: w, setNumber }, values))

    if (w === thisWeek && hasValues(values)) {
      if (day && !sessionLoggedRef.current) {
        sessionLoggedRef.current = true
        const dayId = day.id
        void save.run(() => logSession(todayISO(), dayId))
      }
      if (settings && settings.rest_seconds > 0) timer.start(settings.rest_seconds, 'rest')
    }
  }

  async function handleAddSet(exercise: Exercise) {
    const w = week
    const next = (currentSets(exercise.id).at(-1)?.set_number ?? 0) + 1
    if (next > MAX_SETS) return
    const row = await save.run(() => addSet({ exercise, weekStart: w, setNumber: next }))
    if (row) setSets(prev => (prev.some(s => s.id === row.id) ? prev : [...prev, row]))
  }

  function handleDeleteSet(exercise: Exercise, set: ExerciseSet) {
    if (hasValues(set) && !window.confirm(`Delete set ${set.set_number}?`)) return
    const w = week
    const last = currentSets(exercise.id).at(-1)?.set_number ?? set.set_number
    setSets(prev =>
      prev
        .filter(s => s.id !== set.id)
        .map(s =>
          s.exercise_id === exercise.id && s.week_start === w && s.set_number > set.set_number
            ? { ...s, set_number: s.set_number - 1 }
            : s,
        ),
    )
    void save.run(() => deleteSet(exercise.id, w, set.set_number, last))
  }

  async function handleCopyPrevious(exercise: Exercise) {
    const previous = previousSets(exercise.id)
    if (!previous) return
    const w = week
    const rows = await save.run(() =>
      saveSets(previous.sets.map((s, i) => ({ exercise, weekStart: w, setNumber: i + 1, weight_kg: s.weight_kg, reps: null }))),
    )
    if (rows) setSets(prev => [...prev.filter(s => !(s.exercise_id === exercise.id && s.week_start === w)), ...rows])
  }

  // ---- Notes ----

  function handleSaveNote(exerciseId: string, note: string) {
    const w = week
    setNotes(prev => ({ ...prev, [exerciseId]: note }))
    void save.run(() => saveExerciseNote(exerciseId, w, note))
  }

  function handleDayNoteBlur() {
    if (!day) return
    const trimmed = dayNote.trim()
    setDayNote(trimmed)
    const w = week
    const dayId = day.id
    void save.run(() => saveDayNote(dayId, w, trimmed))
  }

  // ---- Exercises in this day ----

  async function handleAddExercise(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = newName.trim()
    if (!name || !day || !exercises) return
    const position = exercises.reduce((max, x) => Math.max(max, x.position), -1) + 1
    setNewName('')
    const created = await save.run(async () => {
      const movement = await findOrAddMovement(name)
      setMovements(list => (list.some(m => m.id === movement.id) ? list : [...list, movement]))
      return addExercise(day.id, movement, position)
    })
    if (created) setExercises(list => (list ? [...list, created] : [created]))
    else setNewName(name)
  }

  /** Renaming here renames the exercise everywhere, because it is one exercise. */
  function handleRename(exercise: Exercise, name: string) {
    setMovements(list => list.map(m => (m.id === exercise.movement_id ? { ...m, name } : m)))
    void save.run(() => updateMovement(exercise.movement_id, { name }))
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

  /** Takes it out of this day only — the history stays under the exercise. */
  function handleRemoveFromDay(exercise: Exercise) {
    if (!window.confirm(`Remove "${nameOf(exercise)}" from ${DAY_NAMES[dow - 1]}? Everything you logged stays in its history.`)) return
    setExercises(list => list?.filter(x => x.id !== exercise.id) ?? list)
    setSets(prev => prev.filter(s => s.exercise_id !== exercise.id))
    void save.run(() => removeExerciseFromDay(exercise.id))
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
  const used = new Set((exercises ?? []).map(e => e.movement_id))
  const suggestions = movements.filter(movement => !used.has(movement.id))

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

          {week === thisWeek && settings && settings.set_seconds > 0 && (
            <button
              type="button"
              className="btn btn--small btn--accent-outline start-set"
              onClick={() => timer.start(settings.set_seconds, 'set')}
            >
              Start set ({settings.set_seconds}s)
            </button>
          )}

          <input
            className="field day-note"
            value={dayNote}
            onChange={e => setDayNote(e.target.value)}
            onBlur={handleDayNoteBlur}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            maxLength={500}
            placeholder="Note for this week's session"
            aria-label="Note for this day"
          />

          <div className={`exercise-list${refreshing ? ' is-refreshing' : ''}`} aria-busy={refreshing}>
            {exercises.length === 0 && (
              <p className="empty">Nothing planned for this day. Add an exercise below, or keep it as a rest day.</p>
            )}
            {exercises.map((exercise, index) => (
              <ExerciseCard
                key={exercise.id}
                exercise={{ ...exercise, name: nameOf(exercise) }}
                index={index}
                isFirst={index === 0}
                isLast={index === exercises.length - 1}
                sets={currentSets(exercise.id)}
                previous={previousSets(exercise.id)}
                maxSets={MAX_SETS}
                isRecord={records.get(exercise.id) ?? false}
                note={notes[exercise.id] ?? ''}
                catalogId={LIBRARY_ID}
                progressHref={`/exercises/${exercise.movement_id}`}
                onSaveSet={(setNumber, values) => handleSaveSet(exercise, setNumber, values)}
                onAddSet={() => void handleAddSet(exercise)}
                onDeleteSet={set => handleDeleteSet(exercise, set)}
                onCopyPrevious={() => void handleCopyPrevious(exercise)}
                onSaveNote={note => handleSaveNote(exercise.id, note)}
                onRename={name => handleRename(exercise, name)}
                onMove={direction => handleMove(index, direction)}
                onDelete={() => handleRemoveFromDay(exercise)}
              />
            ))}
          </div>

          <form className="add-exercise" onSubmit={handleAddExercise}>
            <input
              className="field"
              list={LIBRARY_ID}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Add from your library, or type a new one"
              maxLength={80}
              aria-label="Exercise to add to this day"
            />
            <button type="submit" className="btn btn--accent" disabled={!newName.trim()}>
              <Plus /> Add
            </button>
          </form>
          <p className="muted add-hint">
            New names are added to <Link to="/exercises">your library</Link> automatically.
          </p>

          <datalist id={LIBRARY_ID}>
            {suggestions.map(movement => (
              <option key={movement.id} value={movement.name} />
            ))}
          </datalist>
        </>
      )}

      <TimerBar timer={timer} />
    </div>
  )
}

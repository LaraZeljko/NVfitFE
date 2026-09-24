import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { formatSet, plural } from '../lib/format'
import { formatShortDate } from '../lib/weeks'
import type { Exercise, ExerciseSet, SetValues } from '../types'
import { Copy, More, Plus } from './Icons'
import SetRow from './SetRow'

export type PreviousSets = { week: string; sets: ExerciseSet[] }

type Props = {
  exercise: Exercise
  index: number
  isFirst: boolean
  isLast: boolean
  sets: ExerciseSet[]
  previous: PreviousSets | null
  maxSets: number
  /** True when this week's top weight beats every earlier week. */
  isRecord: boolean
  note: string
  /** id of the <datalist> with your exercise library */
  catalogId: string
  progressHref: string
  onSaveSet: (setNumber: number, values: SetValues) => void
  onAddSet: () => void
  onDeleteSet: (set: ExerciseSet) => void
  onCopyPrevious: () => void
  onSaveNote: (note: string) => void
  onRename: (name: string) => void
  onMove: (direction: -1 | 1) => void
  /** Removes it from this day; the history stays with the exercise. */
  onDelete: () => void
}

export default function ExerciseCard(props: Props) {
  const { exercise, index, isFirst, isLast, sets, previous, maxSets, isRecord, note, catalogId, progressHref } = props
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(exercise.name)
  const [noteOpen, setNoteOpen] = useState(note !== '')
  const [noteDraft, setNoteDraft] = useState(note)

  // Notes arrive after the cards are already on screen, so pick up what loads later.
  useEffect(() => {
    setNoteDraft(note)
    if (note !== '') setNoteOpen(true)
  }, [note])

  useEffect(() => {
    setNameDraft(exercise.name)
  }, [exercise.name])

  function submitRename(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = nameDraft.trim()
    if (!name) return
    if (name !== exercise.name) props.onRename(name)
    setEditing(false)
  }

  function commitNote() {
    const trimmed = noteDraft.trim()
    if (trimmed === note) return
    props.onSaveNote(trimmed)
  }

  return (
    <article className="exercise">
      <header className="exercise__head">
        <span className="exercise__index" aria-hidden="true">
          {index + 1}
        </span>
        {editing ? (
          <form className="exercise__rename" onSubmit={submitRename}>
            <input
              className="field"
              list={catalogId}
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              maxLength={80}
              aria-label="Exercise name"
              autoFocus
            />
            <button type="submit" className="btn btn--accent btn--small">
              Save
            </button>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                setEditing(false)
                setNameDraft(exercise.name)
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <h2 className="exercise__name">{exercise.name}</h2>
            {isRecord && (
              <span className="badge badge--pr" title="Heavier than any week before">
                New PR
              </span>
            )}
            <button
              type="button"
              className="icon-btn icon-btn--quiet"
              aria-label={`Options for ${exercise.name}`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(open => !open)}
            >
              <More />
            </button>
          </>
        )}
      </header>

      {menuOpen && !editing && (
        <div className="exercise__menu">
          <Link to={progressHref}>See progress</Link>
          <button
            type="button"
            onClick={() => {
              setNameDraft(exercise.name)
              setEditing(true)
              setMenuOpen(false)
            }}
          >
            Rename everywhere
          </button>
          <button type="button" disabled={isFirst} onClick={() => props.onMove(-1)}>
            Move up
          </button>
          <button type="button" disabled={isLast} onClick={() => props.onMove(1)}>
            Move down
          </button>
          <button type="button" className="is-danger" onClick={props.onDelete}>
            Remove from this day
          </button>
        </div>
      )}

      {previous && (
        <p className="exercise__previous">
          <span>Last time · {formatShortDate(previous.week)}</span>
          {previous.sets.map(formatSet).join('  ·  ')}
        </p>
      )}

      {sets.length > 0 && (
        <div className="sets">
          <div className="sets__head" aria-hidden="true">
            <span>#</span>
            <span>kg</span>
            <span>Reps</span>
            <span />
          </div>
          {sets.map(set => (
            <SetRow
              key={set.id}
              set={set}
              hint={previous?.sets.find(p => p.set_number === set.set_number) ?? previous?.sets.at(-1)}
              onSave={values => props.onSaveSet(set.set_number, values)}
              onDelete={() => props.onDeleteSet(set)}
            />
          ))}
        </div>
      )}

      {noteOpen && (
        <input
          className="field exercise__note"
          value={noteDraft}
          onChange={e => setNoteDraft(e.target.value)}
          onBlur={commitNote}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          maxLength={500}
          placeholder="Note — e.g. shoulder hurt, try 65 next time"
          aria-label={`Note for ${exercise.name}`}
        />
      )}

      <div className="exercise__actions">
        {sets.length === 0 && previous && (
          <button type="button" className="btn btn--accent-outline" onClick={props.onCopyPrevious}>
            <Copy /> {previous.sets.length} {plural(previous.sets.length, 'set')} like last time
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={props.onAddSet} disabled={sets.length >= maxSets}>
          <Plus /> Set
        </button>
        {!noteOpen && (
          <button type="button" className="btn btn--ghost" onClick={() => setNoteOpen(true)}>
            Note
          </button>
        )}
      </div>
    </article>
  )
}

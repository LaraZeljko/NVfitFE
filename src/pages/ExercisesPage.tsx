import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Logo, Plus, Trash } from '../components/Icons'
import { ErrorState, Loading, OfflineBanner, SaveIndicator } from '../components/Status'
import TabBar from '../components/TabBar'
import { useSaveQueue } from '../hooks/useSaveQueue'
import { addMovement, deleteMovement, fetchCatalog, fetchMovements, updateMovement } from '../lib/api'
import { errorMessage, plural } from '../lib/format'
import type { Movement } from '../types'

const CATALOG_ID = 'movement-catalog'

export default function ExercisesPage() {
  const [movements, setMovements] = useState<Movement[] | null>(null)
  const [catalog, setCatalog] = useState<string[]>([])
  const [name, setName] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const save = useSaveQueue()

  useEffect(() => {
    let alive = true
    setError(null)
    fetchMovements(true)
      .then(rows => {
        if (alive) setMovements(rows)
      })
      .catch(err => {
        if (alive) setError(errorMessage(err))
      })
    return () => {
      alive = false
    }
  }, [reloadKey])

  useEffect(() => {
    let alive = true
    fetchCatalog()
      .then(rows => {
        if (alive) setCatalog(rows.map(row => row.name))
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  const visible = useMemo(
    () => (movements ?? []).filter(movement => (showArchived ? true : movement.archived_at === null)),
    [movements, showArchived],
  )
  const archivedCount = (movements ?? []).filter(movement => movement.archived_at !== null).length

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if ((movements ?? []).some(movement => movement.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" is already in your list.`)
      return
    }
    setName('')
    setError(null)
    const created = await save.run(() => addMovement(trimmed))
    if (created) setMovements(list => [...(list ?? []), created])
    else setName(trimmed)
  }

  function handleRename(movement: Movement) {
    const trimmed = draft.trim()
    setEditing(null)
    if (!trimmed || trimmed === movement.name) return
    setMovements(list => (list ?? []).map(m => (m.id === movement.id ? { ...m, name: trimmed } : m)))
    void save.run(() => updateMovement(movement.id, { name: trimmed }))
  }

  function handleFavourite(movement: Movement) {
    const next = !movement.is_favourite
    setMovements(list => (list ?? []).map(m => (m.id === movement.id ? { ...m, is_favourite: next } : m)))
    void save.run(() => updateMovement(movement.id, { is_favourite: next }))
  }

  function handleArchive(movement: Movement) {
    const next = movement.archived_at ? null : new Date().toISOString()
    setMovements(list => (list ?? []).map(m => (m.id === movement.id ? { ...m, archived_at: next } : m)))
    void save.run(() => updateMovement(movement.id, { archived_at: next }))
  }

  function handleDelete(movement: Movement) {
    if (!window.confirm(`Delete "${movement.name}" and everything ever logged under it? This cannot be undone.`)) return
    setMovements(list => (list ?? []).filter(m => m.id !== movement.id))
    void save.run(() => deleteMovement(movement.id))
  }

  return (
    <div className="page page--tabs">
      <header className="top">
        <div className="brand">
          <Logo size={32} />
          <span className="brand-word">
            NV<b>fit</b>
          </span>
        </div>
        <SaveIndicator status={save.status} />
      </header>

      <OfflineBanner />

      <p className="eyebrow">Your library</p>
      <h1 className="h1">Exercises</h1>
      <p className="muted lead">
        Name an exercise once here, then add it to any day. Its history follows the exercise, not the day — so the same
        exercise on Monday and Saturday is one story.
      </p>

      <form className="add-exercise" onSubmit={handleAdd}>
        <input
          className="field"
          list={CATALOG_ID}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Incline dumbbell press"
          maxLength={80}
          aria-label="New exercise name"
        />
        <button type="submit" className="btn btn--accent" disabled={!name.trim()}>
          <Plus /> Add
        </button>
      </form>
      <datalist id={CATALOG_ID}>
        {catalog.map(item => (
          <option key={item} value={item} />
        ))}
      </datalist>

      {error && <ErrorState message={error} onRetry={() => setReloadKey(k => k + 1)} />}
      {!movements && !error && <Loading />}

      {movements && visible.length === 0 && (
        <p className="empty">Nothing here yet. Add your main exercises above and they will be offered on every day.</p>
      )}

      {movements && visible.length > 0 && (
        <ul className="movement-list">
          {visible.map(movement => (
            <li key={movement.id} className={movement.archived_at ? 'is-archived' : ''}>
              {editing === movement.id ? (
                <form
                  className="movement__rename"
                  onSubmit={e => {
                    e.preventDefault()
                    handleRename(movement)
                  }}
                >
                  <input className="field" value={draft} onChange={e => setDraft(e.target.value)} maxLength={80} autoFocus aria-label="Exercise name" />
                  <button type="submit" className="btn btn--accent btn--small">
                    Save
                  </button>
                  <button type="button" className="btn btn--small" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className={`star${movement.is_favourite ? ' is-on' : ''}`}
                    onClick={() => handleFavourite(movement)}
                    aria-label={movement.is_favourite ? `Remove ${movement.name} from favourites` : `Mark ${movement.name} as a favourite`}
                    aria-pressed={movement.is_favourite}
                  >
                    ★
                  </button>
                  <Link to={`/exercises/${movement.id}`} className="movement__name">
                    {movement.name}
                    {movement.muscle_group && <span className="muted"> · {movement.muscle_group}</span>}
                  </Link>
                  <button
                    type="button"
                    className="btn btn--small"
                    onClick={() => {
                      setEditing(movement.id)
                      setDraft(movement.name)
                    }}
                  >
                    Rename
                  </button>
                  <button type="button" className="btn btn--small" onClick={() => handleArchive(movement)}>
                    {movement.archived_at ? 'Restore' : 'Hide'}
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--quiet"
                    onClick={() => handleDelete(movement)}
                    aria-label={`Delete ${movement.name}`}
                  >
                    <Trash />
                  </button>
                  <Link to={`/exercises/${movement.id}`} className="icon-btn icon-btn--quiet" aria-label={`Progress for ${movement.name}`}>
                    <ChevronRight />
                  </Link>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {archivedCount > 0 && (
        <button type="button" className="link-btn" onClick={() => setShowArchived(value => !value)}>
          {showArchived ? 'Hide' : `Show ${archivedCount} hidden ${plural(archivedCount, 'exercise')}`}
        </button>
      )}

      <TabBar />
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ImageCropper from '../components/ImageCropper'
import { Camera, ChevronLeft, Trash } from '../components/Icons'
import { ErrorState, Loading, OfflineBanner, SaveIndicator } from '../components/Status'
import { useSaveQueue } from '../hooks/useSaveQueue'
import { deletePhoto, fetchPhotos, signPhotoUrl, uploadPhoto } from '../lib/api'
import { errorMessage, formatNumber, parseWeight, plural } from '../lib/format'
import { formatShortDate, parseISODate, todayISO } from '../lib/weeks'
import type { ProgressPhoto } from '../types'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function monthLabel(isoDate: string) {
  const date = parseISODate(isoDate)
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

function PhotoImage({ photo, className }: { photo: ProgressPhoto; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    signPhotoUrl(photo.storage_path)
      .then(signed => {
        if (alive) setUrl(signed)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [photo.storage_path])

  if (!url) return <span className={`photo__placeholder ${className ?? ''}`} aria-hidden="true" />
  return <img className={className} src={url} alt={`Progress photo from ${formatShortDate(photo.taken_on)}`} />
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<ProgressPhoto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [takenOn, setTakenOn] = useState(todayISO())
  const [note, setNote] = useState('')
  const [weight, setWeight] = useState('')
  const [comparing, setComparing] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement | null>(null)
  const save = useSaveQueue()

  useEffect(() => {
    let alive = true
    setError(null)
    fetchPhotos()
      .then(rows => {
        if (alive) setPhotos(rows)
      })
      .catch(err => {
        if (alive) setError(errorMessage(err))
      })
    return () => {
      alive = false
    }
  }, [reloadKey])

  const byMonth = useMemo(() => {
    const groups = new Map<string, ProgressPhoto[]>()
    for (const photo of photos ?? []) {
      const key = monthLabel(photo.taken_on)
      const list = groups.get(key)
      if (list) list.push(photo)
      else groups.set(key, [photo])
    }
    return [...groups.entries()]
  }, [photos])

  const pair = (photos ?? []).filter(photo => selected.includes(photo.id)).sort((a, b) => a.taken_on.localeCompare(b.taken_on))

  async function handleCropped(blob: Blob) {
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
    const date = takenOn
    const text = note.trim() || null
    const kg = parseWeight(weight)
    setPendingFile(null)
    setNote('')
    setWeight('')
    const created = await save.run(() => uploadPhoto(file, date, text, kg === undefined ? null : kg))
    if (created) setPhotos(list => [created, ...(list ?? [])])
  }

  function handleDelete(photo: ProgressPhoto) {
    if (!window.confirm(`Delete the photo from ${formatShortDate(photo.taken_on)}?`)) return
    setPhotos(list => (list ?? []).filter(p => p.id !== photo.id))
    setSelected(ids => ids.filter(id => id !== photo.id))
    void save.run(() => deletePhoto(photo))
  }

  function toggleSelected(photo: ProgressPhoto) {
    setSelected(ids => {
      if (ids.includes(photo.id)) return ids.filter(id => id !== photo.id)
      if (ids.length >= 2) return [ids[1], photo.id]
      return [...ids, photo.id]
    })
  }

  return (
    <div className="page">
      <header className="top top--sticky">
        <Link to="/body" className="icon-btn" aria-label="Back to body">
          <ChevronLeft />
        </Link>
        <span className="top__title">Photos</span>
        <SaveIndicator status={save.status} />
      </header>

      <OfflineBanner />

      <p className="muted lead">
        Only you can see these — not even a connected partner. Take one every week or month and the change shows up on its own.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) {
            setTakenOn(todayISO())
            setPendingFile(file)
          }
        }}
      />

      {pendingFile ? (
        <section className="card">
          <h2 className="card__title">Add a photo</h2>
          <div className="body-grid">
            <label className="label">
              Date
              <input className="field" type="date" max={todayISO()} value={takenOn} onChange={e => setTakenOn(e.target.value || todayISO())} />
            </label>
            <label className="label">
              Weight (kg)
              <input className="field field--num" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} />
            </label>
          </div>
          <label className="label">
            Note
            <input className="field" maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" />
          </label>
          <ImageCropper file={pendingFile} onCancel={() => setPendingFile(null)} onDone={blob => void handleCropped(blob)} />
        </section>
      ) : (
        <div className="photo-actions">
          <button type="button" className="btn btn--accent" onClick={() => fileRef.current?.click()}>
            <Camera /> Add photo
          </button>
          {(photos?.length ?? 0) >= 2 && (
            <button
              type="button"
              className="btn"
              aria-pressed={comparing}
              onClick={() => {
                setComparing(value => !value)
                setSelected([])
              }}
            >
              {comparing ? 'Done comparing' : 'Compare two'}
            </button>
          )}
        </div>
      )}

      {comparing && (
        <section className="card">
          <h2 className="card__title">Side by side</h2>
          <p className="card__sub">
            {pair.length < 2 ? `Pick ${2 - pair.length} more ${plural(2 - pair.length, 'photo')} below` : 'Oldest on the left'}
          </p>
          {pair.length === 2 && (
            <div className="compare">
              {pair.map(photo => (
                <figure key={photo.id}>
                  <PhotoImage photo={photo} />
                  <figcaption>
                    {formatShortDate(photo.taken_on)}
                    {photo.weight_kg !== null && <span className="muted"> · {formatNumber(photo.weight_kg)} kg</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      {error && <ErrorState message={error} onRetry={() => setReloadKey(k => k + 1)} />}
      {!photos && !error && <Loading />}

      {photos && photos.length === 0 && <p className="empty">No photos yet. The first one is the "before".</p>}

      {byMonth.map(([month, group]) => (
        <section key={month} className="group">
          <h2 className="group__title">{month}</h2>
          <div className="photo-grid">
            {group.map(photo => (
              <div key={photo.id} className={`photo${selected.includes(photo.id) ? ' is-selected' : ''}`}>
                {comparing ? (
                  <button type="button" className="photo__pick" onClick={() => toggleSelected(photo)} aria-pressed={selected.includes(photo.id)}>
                    <PhotoImage photo={photo} />
                  </button>
                ) : (
                  <PhotoImage photo={photo} />
                )}
                <div className="photo__meta">
                  <span>{formatShortDate(photo.taken_on)}</span>
                  {photo.weight_kg !== null && <span className="muted">{formatNumber(photo.weight_kg)} kg</span>}
                </div>
                {photo.note && <p className="photo__note">{photo.note}</p>}
                {!comparing && (
                  <button
                    type="button"
                    className="icon-btn icon-btn--quiet photo__delete"
                    onClick={() => handleDelete(photo)}
                    aria-label={`Delete the photo from ${formatShortDate(photo.taken_on)}`}
                  >
                    <Trash />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

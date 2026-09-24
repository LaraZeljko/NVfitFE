import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import ImageCropper from '../components/ImageCropper'
import { ChevronLeft, Plus, Trash } from '../components/Icons'
import { ErrorState, Loading, SaveIndicator } from '../components/Status'
import { useCute } from '../hooks/useCute'
import { useSaveQueue } from '../hooks/useSaveQueue'
import {
  addMessage,
  deleteMessage,
  deleteStreakImage,
  fetchMessages,
  fetchStreakImages,
  signImageUrl,
  updateMessage,
  uploadStreakImage,
} from '../lib/api'
import { errorMessage } from '../lib/format'
import { STATE_HINTS, STATE_LABELS } from '../lib/streak'
import { DAY_NAMES, formatShortDate, todayISO } from '../lib/weeks'
import type { LoveMessage, StreakImage, StreakState } from '../types'

const STATES: StreakState[] = ['chill', 'stressed', 'angry', 'rest', 'celebration']

function Thumb({ image, onDelete }: { image: StreakImage; onDelete: () => void }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    signImageUrl(image.storage_path)
      .then(signed => {
        if (alive) setUrl(signed)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [image.storage_path])

  return (
    <div className="thumb">
      {url ? <img src={url} alt={image.caption ?? ''} /> : <span className="thumb__placeholder" aria-hidden="true" />}
      <button type="button" className="icon-btn icon-btn--quiet thumb__delete" onClick={onDelete} aria-label="Delete this picture">
        <Trash />
      </button>
    </div>
  )
}

export default function AdminPage() {
  const { loading, partners, incoming } = useCute()
  const save = useSaveQueue()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [messages, setMessages] = useState<LoveMessage[] | null>(null)
  const [images, setImages] = useState<StreakImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [body, setBody] = useState('')
  const [scope, setScope] = useState<'any' | 'weekday' | 'date'>('any')
  const [weekday, setWeekday] = useState(1)
  const [date, setDate] = useState(todayISO())

  const [pendingState, setPendingState] = useState<StreakState | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')

  const partner = partners[0] ?? null

  useEffect(() => {
    if (!partner) return
    let alive = true
    setError(null)
    Promise.all([fetchMessages(partner.userId), fetchStreakImages(partner.userId)])
      .then(([loadedMessages, loadedImages]) => {
        if (!alive) return
        setMessages(loadedMessages)
        setImages(loadedImages)
      })
      .catch(err => {
        if (alive) setError(errorMessage(err))
      })
    return () => {
      alive = false
    }
  }, [partner, reloadKey])

  const header = (
    <header className="top top--sticky">
      <Link to="/" className="icon-btn" aria-label="Back to the week">
        <ChevronLeft />
      </Link>
      <span className="top__title">{partner ? `For ${partner.myLabelForThem ?? 'your partner'}` : 'Partner'}</span>
      <SaveIndicator status={save.status} />
    </header>
  )

  async function handleAddMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = body.trim()
    if (!text || !partner) return
    setBody('')
    const created = await save.run(() =>
      addMessage(partner.userId, text, {
        day_of_week: scope === 'weekday' ? weekday : null,
        show_date: scope === 'date' ? date : null,
      }),
    )
    if (created) setMessages(list => [...(list ?? []), created])
    else setBody(text)
  }

  function handleToggle(message: LoveMessage) {
    setMessages(list => (list ?? []).map(m => (m.id === message.id ? { ...m, is_active: !m.is_active } : m)))
    void save.run(() => updateMessage(message.id, { is_active: !message.is_active }))
  }

  function handleDeleteMessage(message: LoveMessage) {
    if (!window.confirm('Delete this message?')) return
    setMessages(list => (list ?? []).filter(m => m.id !== message.id))
    void save.run(() => deleteMessage(message.id))
  }

  function pickFile(state: StreakState) {
    setPendingState(state)
    setCaption('')
    fileRef.current?.click()
  }

  async function handleCropped(blob: Blob) {
    const state = pendingState
    setPendingFile(null)
    setPendingState(null)
    if (!state || !partner) return
    const file = new File([blob], `${state}.jpg`, { type: 'image/jpeg' })
    const uploaded = await save.run(() => uploadStreakImage(partner.userId, state, file, caption.trim() || null))
    if (uploaded) setImages(list => [...list, uploaded])
  }

  function handleDeleteImage(image: StreakImage) {
    if (!window.confirm('Delete this picture?')) return
    setImages(list => list.filter(i => i.id !== image.id))
    void save.run(() => deleteStreakImage(image))
  }

  if (loading) {
    return (
      <div className="page">
        {header}
        <Loading />
      </div>
    )
  }

  // ---- Not connected to anyone yet ----
  if (!partner) {
    return (
      <div className="page">
        {header}
        <div className="empty">
          <p>
            {incoming.length > 0
              ? 'Someone wants to connect with you.'
              : 'Connect with someone first, then you can leave messages and pictures in their app.'}
          </p>
          <Link className="btn btn--accent" to="/settings">
            Open settings
          </Link>
        </div>
      </div>
    )
  }

  // ---- Connected ----
  return (
    <div className="page">
      {header}

      {error && <ErrorState message={error} onRetry={() => setReloadKey(k => k + 1)} />}
      {save.error && (
        <div className="banner banner--error" role="alert">
          {save.error}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) setPendingFile(file)
        }}
      />

      {pendingFile && (
        <section className="card">
          <h2 className="card__title">Crop the picture</h2>
          <p className="card__sub">{pendingState && STATE_LABELS[pendingState]} — drag to move, slider to zoom</p>
          <label className="label">
            Caption (optional)
            <input className="field" maxLength={200} value={caption} onChange={e => setCaption(e.target.value)} />
          </label>
          <ImageCropper
            file={pendingFile}
            onCancel={() => {
              setPendingFile(null)
              setPendingState(null)
            }}
            onDone={blob => void handleCropped(blob)}
          />
        </section>
      )}

      <section className="card">
        <h2 className="card__title">Pictures</h2>
        <p className="card__sub">Add as many as you like per state — one is picked each day.</p>
        {STATES.map(state => (
          <div key={state} className="state-block">
            <div className="state-block__head">
              <strong>{STATE_LABELS[state]}</strong>
              <span className="muted">{STATE_HINTS[state]}</span>
            </div>
            <div className="thumbs">
              {images
                .filter(image => image.state === state)
                .map(image => (
                  <Thumb key={image.id} image={image} onDelete={() => handleDeleteImage(image)} />
                ))}
              <button type="button" className="thumb thumb--add" onClick={() => pickFile(state)}>
                <Plus />
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="card__title">Messages</h2>
        <p className="card__sub">They see one a day, on their week screen.</p>

        <form className="message-form" onSubmit={handleAddMessage}>
          <input
            className="field"
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={300}
            placeholder="Write something for them"
            aria-label="Message"
          />
          <div className="chips" role="group" aria-label="When to show it">
            <button type="button" className="chip" aria-pressed={scope === 'any'} onClick={() => setScope('any')}>
              Any day
            </button>
            <button type="button" className="chip" aria-pressed={scope === 'weekday'} onClick={() => setScope('weekday')}>
              A weekday
            </button>
            <button type="button" className="chip" aria-pressed={scope === 'date'} onClick={() => setScope('date')}>
              One date
            </button>
          </div>
          {scope === 'weekday' && (
            <label className="label settings-field">
              Weekday
              <select className="field" value={weekday} onChange={e => setWeekday(Number(e.target.value))}>
                {DAY_NAMES.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {scope === 'date' && (
            <label className="label settings-field">
              Date
              <input className="field" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </label>
          )}
          <button type="submit" className="btn btn--accent" disabled={!body.trim()}>
            <Plus /> Add message
          </button>
        </form>

        {!messages ? (
          <Loading />
        ) : messages.length === 0 ? (
          <p className="muted">No messages yet.</p>
        ) : (
          <ul className="message-list">
            {messages.map(message => (
              <li key={message.id} className={message.is_active ? '' : 'is-off'}>
                <div className="message-list__body">
                  <span>{message.body}</span>
                  <span className="muted">
                    {message.show_date
                      ? formatShortDate(message.show_date)
                      : message.day_of_week
                        ? DAY_NAMES[message.day_of_week - 1]
                        : 'Any day'}
                  </span>
                </div>
                <button type="button" className="btn btn--small" onClick={() => handleToggle(message)}>
                  {message.is_active ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--quiet"
                  onClick={() => handleDeleteMessage(message)}
                  aria-label="Delete message"
                >
                  <Trash />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

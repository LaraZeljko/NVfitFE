import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from '../components/Icons'
import { Loading } from '../components/Status'
import { useCute } from '../hooks/useCute'
import { useSaveQueue } from '../hooks/useSaveQueue'
import { useSettings } from '../hooks/useSettings'
import { cancelConnection, requestConnection, respondToConnection } from '../lib/api'

const REST_PRESETS = [60, 90, 120, 180]
const SET_PRESETS = [0, 30, 45, 60]

function formatSeconds(seconds: number) {
  if (seconds === 0) return 'Off'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`
}

function PartnerSection() {
  const { loading, partners, incoming, outgoing, reload } = useCute()
  const save = useSaveQueue()
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState('')

  const partner = partners[0] ?? null

  async function handleRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const address = email.trim()
    if (!address) return
    const done = await save.run(() => requestConnection(address, label.trim() || null))
    if (done !== undefined) {
      setEmail('')
      setLabel('')
      reload()
    }
  }

  async function handleRespond(connectionId: string, accept: boolean) {
    const name = accept ? window.prompt('What do you call them? This is how the app greets you from them.') : null
    const done = await save.run(() => respondToConnection(connectionId, accept, name?.trim() || null))
    if (done !== undefined) reload()
  }

  async function handleRemove(connectionId: string, name: string) {
    if (
      !window.confirm(
        `Disconnect from ${name}? It ends for both of you, and the messages and pictures you left in each other's app are deleted.`,
      )
    )
      return
    const done = await save.run(() => cancelConnection(connectionId))
    if (done !== undefined) reload()
  }

  if (loading) return <Loading />

  return (
    <section className="card">
      <h2 className="card__title">Partner</h2>
      <p className="card__sub">Connect with one person and you can both leave messages and pictures in each other's app.</p>

      {save.error && (
        <p className="form-message form-message--error" role="alert">
          {save.error}
        </p>
      )}

      {partner ? (
        <>
          <div className="request-row">
            <span>
              Connected to <strong>{partner.myLabelForThem ?? 'your partner'}</strong>
            </span>
            <Link className="btn btn--small btn--accent" to="/admin">
              Messages and pictures
            </Link>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => void handleRemove(partner.connectionId, partner.myLabelForThem ?? 'your partner')}
            >
              Disconnect
            </button>
          </div>
          <p className="muted">One partner at a time — disconnect first if you want to connect with someone else.</p>
        </>
      ) : (
        <>
          {incoming.map(request => (
            <div key={request.id} className="request-row">
              <span>{request.requester_label ? `${request.requester_label} wants to connect` : 'Someone wants to connect'}</span>
              <button type="button" className="btn btn--accent btn--small" onClick={() => void handleRespond(request.id, true)}>
                Accept
              </button>
              <button type="button" className="btn btn--small" onClick={() => void handleRespond(request.id, false)}>
                Decline
              </button>
            </div>
          ))}

          {outgoing.map(request => (
            <div key={request.id} className="request-row">
              <span>Waiting for {request.requester_label ?? 'them'} to accept</span>
              <button type="button" className="btn btn--small" onClick={() => void handleRemove(request.id, request.requester_label ?? 'them')}>
                Cancel
              </button>
            </div>
          ))}

          {outgoing.length === 0 && (
            <form className="message-form" onSubmit={handleRequest}>
              <label className="label">
                Their email
                <input
                  className="field"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="The email they signed up with"
                  required
                />
              </label>
              <label className="label">
                What you call them
                <input className="field" maxLength={40} value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Neven" />
              </label>
              <button type="submit" className="btn btn--accent" disabled={!email.trim()}>
                Send request
              </button>
            </form>
          )}
        </>
      )}
    </section>
  )
}

export default function SettingsPage() {
  const { settings, update } = useSettings()

  return (
    <div className="page">
      <header className="top top--sticky">
        <Link to="/" className="icon-btn" aria-label="Back to the week">
          <ChevronLeft />
        </Link>
        <span className="top__title">Settings</span>
        <span className="icon-btn icon-btn--placeholder" aria-hidden="true" />
      </header>

      <PartnerSection />

      {!settings ? (
        <Loading />
      ) : (
        <>
          <section className="card">
            <h2 className="card__title">Rest between sets</h2>
            <p className="card__sub">The countdown starts on its own once you write down a set.</p>
            <div className="chips" role="group" aria-label="Rest length">
              {REST_PRESETS.map(value => (
                <button
                  key={value}
                  type="button"
                  className="chip"
                  aria-pressed={settings.rest_seconds === value}
                  onClick={() => void update({ rest_seconds: value })}
                >
                  {formatSeconds(value)}
                </button>
              ))}
            </div>
            <label className="label settings-field">
              Custom (seconds)
              <input
                className="field field--num"
                type="number"
                min={0}
                max={600}
                step={5}
                value={settings.rest_seconds}
                onChange={e => void update({ rest_seconds: Math.min(600, Math.max(0, Number(e.target.value) || 0)) })}
              />
            </label>
          </section>

          <section className="card">
            <h2 className="card__title">Set length</h2>
            <p className="card__sub">For timed sets — planks, holds, circuits. Leave it off for normal lifting.</p>
            <div className="chips" role="group" aria-label="Set length">
              {SET_PRESETS.map(value => (
                <button
                  key={value}
                  type="button"
                  className="chip"
                  aria-pressed={settings.set_seconds === value}
                  onClick={() => void update({ set_seconds: value })}
                >
                  {formatSeconds(value)}
                </button>
              ))}
            </div>
            <label className="label settings-field">
              Custom (seconds)
              <input
                className="field field--num"
                type="number"
                min={0}
                max={600}
                step={5}
                value={settings.set_seconds}
                onChange={e => void update({ set_seconds: Math.min(600, Math.max(0, Number(e.target.value) || 0)) })}
              />
            </label>
          </section>
        </>
      )}
    </div>
  )
}

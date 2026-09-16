import { Link } from 'react-router-dom'
import { ChevronLeft } from '../components/Icons'
import { Loading } from '../components/Status'
import { useSettings } from '../hooks/useSettings'

const REST_PRESETS = [60, 90, 120, 180]
const SET_PRESETS = [0, 30, 45, 60]

function formatSeconds(seconds: number) {
  if (seconds === 0) return 'Off'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`
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

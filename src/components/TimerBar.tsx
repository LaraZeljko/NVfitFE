import type { Timer } from '../hooks/useTimer'
import { Close, Plus } from './Icons'

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Sticky countdown above the bottom of the day screen. */
export default function TimerBar({ timer }: { timer: Timer }) {
  if (!timer.running) return null

  const done = timer.secondsLeft === 0
  const progress = timer.total > 0 ? 1 - timer.secondsLeft / timer.total : 1
  const label = done ? (timer.mode === 'set' ? 'Set finished' : 'Rest over — next set') : timer.mode === 'set' ? 'Set' : 'Rest'

  return (
    <div className={`timer${done ? ' is-done' : ''}`} role="status" aria-live="polite">
      <div className="timer__bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }} />
      </div>
      <div className="timer__row">
        <div className="timer__time">
          <span className="timer__label">{label}</span>
          <strong>{formatClock(timer.secondsLeft)}</strong>
        </div>
        <div className="timer__actions">
          <button type="button" className="btn btn--small" onClick={() => timer.add(15)}>
            <Plus /> 15s
          </button>
          {!done && (
            <button type="button" className="btn btn--small" onClick={timer.paused ? timer.resume : timer.pause}>
              {timer.paused ? 'Resume' : 'Pause'}
            </button>
          )}
          <button type="button" className="icon-btn icon-btn--quiet" onClick={timer.stop} aria-label="Close the timer">
            <Close />
          </button>
        </div>
      </div>
    </div>
  )
}

import type { SaveStatus } from '../hooks/useSaveQueue'
import { useOnline } from '../hooks/useOnline'
import { Check } from './Icons'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="status" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="status status--error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function SaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <span className={`save-indicator save-indicator--${status}`} aria-live="polite">
      {status === 'saving' && 'Saving…'}
      {status === 'saved' && (
        <>
          <Check /> Saved
        </>
      )}
      {status === 'error' && 'Not saved'}
    </span>
  )
}

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="banner" role="status">
      You are offline. Changes will not be saved until the connection is back.
    </div>
  )
}

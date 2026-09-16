import { useCallback, useRef, useState } from 'react'
import { errorMessage } from '../lib/format'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Saves run one after another, so that deleting a set (and renumbering the
 * rest) never overlaps with a weight being written.
 * run() never throws: it resolves to undefined and the failure stays in `error`.
 */
export function useSaveQueue() {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const pending = useRef(0)

  const run = useCallback(<T>(task: () => Promise<T>): Promise<T | undefined> => {
    pending.current += 1
    setStatus(current => (current === 'error' ? current : 'saving'))

    const result = queue.current.then(task).then(
      value => {
        pending.current -= 1
        if (pending.current === 0) setStatus(current => (current === 'error' ? current : 'saved'))
        return value
      },
      (err: unknown) => {
        pending.current -= 1
        setStatus('error')
        setError(errorMessage(err))
        return undefined
      },
    )
    queue.current = result
    return result
  }, [])

  const clearError = useCallback(() => {
    setError(null)
    setStatus('idle')
  }, [])

  return { status, error, run, clearError }
}

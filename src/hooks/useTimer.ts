import { useCallback, useEffect, useRef, useState } from 'react'

export type TimerMode = 'set' | 'rest'

type TimerState = {
  mode: TimerMode
  total: number
  endsAt: number
  paused: boolean
  remainingWhenPaused: number
}

/**
 * Countdown for the set and the rest between sets.
 * The end time is an absolute timestamp, so the count stays correct even if the
 * phone throttles timers while the screen is off.
 */
export function useTimer() {
  const [state, setState] = useState<TimerState | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const audioRef = useRef<AudioContext | null>(null)
  const firedRef = useRef(false)

  useEffect(() => {
    if (!state || state.paused) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [state])

  const secondsLeft = state
    ? state.paused
      ? state.remainingWhenPaused
      : Math.max(0, Math.ceil((state.endsAt - now) / 1000))
    : 0

  // Short beep plus a vibration when the countdown hits zero.
  useEffect(() => {
    if (!state || state.paused) return
    if (secondsLeft > 0) {
      firedRef.current = false
      return
    }
    if (firedRef.current) return
    firedRef.current = true

    try {
      const context = audioRef.current
      if (context) {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.frequency.value = 880
        gain.gain.setValueAtTime(0.0001, context.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.3, context.currentTime + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45)
        oscillator.connect(gain).connect(context.destination)
        oscillator.start()
        oscillator.stop(context.currentTime + 0.5)
      }
    } catch {
      // Sound is a nicety; never let it break the screen.
    }
    navigator.vibrate?.([200, 100, 200])
  }, [secondsLeft, state])

  const start = useCallback((seconds: number, mode: TimerMode) => {
    if (seconds <= 0) return
    // The audio context has to be created from a user gesture to be allowed to play later.
    if (!audioRef.current && typeof AudioContext !== 'undefined') {
      try {
        audioRef.current = new AudioContext()
      } catch {
        audioRef.current = null
      }
    }
    void audioRef.current?.resume().catch(() => undefined)
    firedRef.current = false
    setNow(Date.now())
    setState({ mode, total: seconds, endsAt: Date.now() + seconds * 1000, paused: false, remainingWhenPaused: seconds })
  }, [])

  const pause = useCallback(() => {
    setState(current => {
      if (!current || current.paused) return current
      return { ...current, paused: true, remainingWhenPaused: Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000)) }
    })
  }, [])

  const resume = useCallback(() => {
    setState(current => {
      if (!current || !current.paused) return current
      setNow(Date.now())
      return { ...current, paused: false, endsAt: Date.now() + current.remainingWhenPaused * 1000 }
    })
  }, [])

  const add = useCallback((seconds: number) => {
    setState(current => {
      if (!current) return current
      if (current.paused) return { ...current, remainingWhenPaused: current.remainingWhenPaused + seconds, total: current.total + seconds }
      return { ...current, endsAt: current.endsAt + seconds * 1000, total: current.total + seconds }
    })
  }, [])

  const stop = useCallback(() => setState(null), [])

  return {
    mode: state?.mode ?? null,
    total: state?.total ?? 0,
    secondsLeft,
    running: state !== null,
    paused: state?.paused ?? false,
    start,
    pause,
    resume,
    add,
    stop,
  }
}

export type Timer = ReturnType<typeof useTimer>

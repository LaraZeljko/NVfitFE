import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchConnections, fetchMyMessages, fetchStreakImages } from '../lib/api'
import { todayDayOfWeek, todayISO } from '../lib/weeks'
import type { Connection, LoveMessage, StreakImage } from '../types'

export type Partner = {
  connectionId: string
  userId: string
  /** What you call them. */
  myLabelForThem: string | null
  /** What they call you — used for the greeting in your app. */
  theirLabelForYou: string | null
}

type Decoration = {
  displayName: string
  messages: LoveMessage[]
  images: StreakImage[]
}

type CuteContextValue = {
  loading: boolean
  partners: Partner[]
  /** Requests waiting for your answer. */
  incoming: Connection[]
  /** Requests you sent that have not been answered. */
  outgoing: Connection[]
  /** Set when a partner has put something in your app. */
  decoration: Decoration | null
  reload: () => void
}

const empty: Omit<CuteContextValue, 'reload'> = {
  loading: true,
  partners: [],
  incoming: [],
  outgoing: [],
  decoration: null,
}

const CuteContext = createContext<CuteContextValue>({ ...empty, reload: () => {} })

export function CuteProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [value, setValue] = useState(empty)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const connections = await fetchConnections()

        const partners: Partner[] = connections
          .filter(c => c.status === 'accepted')
          .map(c =>
            c.requester_id === userId
              ? {
                  connectionId: c.id,
                  userId: c.addressee_id,
                  myLabelForThem: c.requester_label,
                  theirLabelForYou: c.addressee_label,
                }
              : {
                  connectionId: c.id,
                  userId: c.requester_id,
                  myLabelForThem: c.addressee_label,
                  theirLabelForYou: c.requester_label,
                },
          )

        const incoming = connections.filter(c => c.status === 'pending' && c.addressee_id === userId)
        const outgoing = connections.filter(c => c.status === 'pending' && c.requester_id === userId)

        let decoration: Decoration | null = null
        if (partners.length > 0) {
          const [messages, images] = await Promise.all([fetchMyMessages(), fetchStreakImages()])
          const mine = images.filter(image => image.target_user_id === userId)
          if (messages.length > 0 || mine.length > 0) {
            decoration = { displayName: partners[0].theirLabelForYou ?? 'you', messages, images: mine }
          }
        }

        if (alive) setValue({ loading: false, partners, incoming, outgoing, decoration })
      } catch {
        // These are extras: if they fail, the app works exactly as it does for anyone else.
        if (alive) setValue({ ...empty, loading: false })
      }
    })()
    return () => {
      alive = false
    }
  }, [userId, reloadKey])

  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  return <CuteContext.Provider value={{ ...value, reload }}>{children}</CuteContext.Provider>
}

export function useCute() {
  return useContext(CuteContext)
}

/**
 * Today's message: a message for this exact date wins, then one set for this
 * weekday, otherwise one from the free pool — the same one all day.
 */
export function pickMessage(messages: LoveMessage[]): LoveMessage | null {
  const today = todayISO()
  const dow = todayDayOfWeek()

  const exact = messages.find(m => m.show_date === today)
  if (exact) return exact

  const weekday = messages.filter(m => m.day_of_week === dow)
  if (weekday.length > 0) return weekday[dayIndex(today, weekday.length)]

  const pool = messages.filter(m => m.day_of_week === null && m.show_date === null)
  if (pool.length > 0) return pool[dayIndex(today, pool.length)]

  return null
}

/** Stable "random" choice that only changes when the date changes. */
function dayIndex(date: string, length: number) {
  let hash = 0
  for (const character of date) hash = (hash * 31 + character.charCodeAt(0)) % 100000
  return hash % length
}

export function pickImage(images: StreakImage[], state: string): StreakImage | null {
  const matching = images.filter(image => image.state === state)
  if (matching.length === 0) return null
  return matching[dayIndex(todayISO(), matching.length)]
}

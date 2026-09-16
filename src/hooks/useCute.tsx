import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchAdminTargets, fetchIsAdmin, fetchMyMessages, fetchStreakImages } from '../lib/api'
import { todayDayOfWeek, todayISO } from '../lib/weeks'
import type { AdminTarget, LoveMessage, StreakImage } from '../types'

type Decoration = {
  /** How the app greets this user, set by the person who decorates it. */
  displayName: string
  messages: LoveMessage[]
  images: StreakImage[]
}

type CuteContextValue = {
  loading: boolean
  /** True when this account may write messages and upload pictures for someone else. */
  isAdmin: boolean
  /** People whose app this account decorates. */
  targets: AdminTarget[]
  /** Set when somebody decorates THIS account's app. */
  decoration: Decoration | null
  reload: () => void
}

const CuteContext = createContext<CuteContextValue>({
  loading: true,
  isAdmin: false,
  targets: [],
  decoration: null,
  reload: () => {},
})

export function CuteProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [value, setValue] = useState<Omit<CuteContextValue, 'reload'>>({
    loading: true,
    isAdmin: false,
    targets: [],
    decoration: null,
  })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [admin, links] = await Promise.all([fetchIsAdmin(userId), fetchAdminTargets()])
        const targets = links.filter(link => link.admin_id === userId)
        const decorators = links.filter(link => link.target_user_id === userId)

        let decoration: Decoration | null = null
        if (decorators.length > 0) {
          const [messages, images] = await Promise.all([fetchMyMessages(), fetchStreakImages()])
          decoration = { displayName: decorators[0].display_name, messages, images }
        }
        if (alive) setValue({ loading: false, isAdmin: admin, targets, decoration })
      } catch {
        // These are extras: if they fail, the app works exactly as it does for anyone else.
        if (alive) setValue({ loading: false, isAdmin: false, targets: [], decoration: null })
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

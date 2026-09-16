import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchSettings, saveSettings } from '../lib/api'
import type { UserSettings } from '../types'

type SettingsContextValue = {
  settings: UserSettings | null
  update: (values: Partial<Pick<UserSettings, 'set_seconds' | 'rest_seconds'>>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>({ settings: null, update: async () => {} })

export function SettingsProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null)

  useEffect(() => {
    let alive = true
    fetchSettings(userId)
      .then(row => {
        if (alive) setSettings(row)
      })
      .catch(() => {
        // Settings are a convenience: if they cannot be read, the app still works on defaults.
        if (alive) setSettings({ user_id: userId, set_seconds: 0, rest_seconds: 90, cute_mode: false })
      })
    return () => {
      alive = false
    }
  }, [userId])

  const update = useCallback(
    async (values: Partial<Pick<UserSettings, 'set_seconds' | 'rest_seconds'>>) => {
      setSettings(current => (current ? { ...current, ...values } : current))
      await saveSettings(userId, values)
    },
    [userId],
  )

  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  return useContext(SettingsContext)
}

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Logo } from './components/Icons'
import { CuteProvider } from './hooks/useCute'
import { SettingsProvider } from './hooks/useSettings'
import { useSession } from './hooks/useSession'
import { isConfigured } from './lib/supabase'
import AdminPage from './pages/AdminPage'
import BodyPage from './pages/BodyPage'
import DayPage from './pages/DayPage'
import ExerciseProgressPage from './pages/ExerciseProgressPage'
import LoginPage from './pages/LoginPage'
import ProgressPage from './pages/ProgressPage'
import SettingsPage from './pages/SettingsPage'
import SetupNotice from './pages/SetupNotice'
import WeekPage from './pages/WeekPage'

export default function App() {
  const { session, loading } = useSession()

  if (!isConfigured) return <SetupNotice />
  if (loading) {
    return (
      <div className="splash" role="status" aria-label="Loading">
        <Logo size={72} />
      </div>
    )
  }
  if (!session) return <LoginPage />

  return (
    <SettingsProvider userId={session.user.id}>
      <CuteProvider userId={session.user.id}>
        <BrowserRouter key={session.user.id}>
          <Routes>
            <Route path="/" element={<WeekPage />} />
            <Route path="/day/:dow" element={<DayPage />} />
            <Route path="/body" element={<BodyPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/progress/:exerciseId" element={<ExerciseProgressPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CuteProvider>
    </SettingsProvider>
  )
}

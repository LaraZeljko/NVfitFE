import { useState } from 'react'
import type { FormEvent } from 'react'
import { Logo } from '../components/Icons'
import { errorMessage } from '../lib/format'
import { supabase } from '../lib/supabase'

const AUTH_ERRORS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Wrong email or password.'],
  [/email not confirmed/i, 'Your email is not confirmed yet. Open the link we sent you.'],
  [/already registered|already been registered/i, 'An account with this email already exists. Sign in instead.'],
  [/at least 6 characters/i, 'The password must be at least 6 characters long.'],
  [/rate limit|too many/i, 'Too many attempts. Wait a few minutes.'],
]

function authMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return AUTH_ERRORS.find(([pattern]) => pattern.test(message))?.[1] ?? errorMessage(error)
}

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) setInfo('Account created. Confirm your email through the link we sent, then sign in.')
      }
    } catch (err) {
      setError(authMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function toggleMode() {
    setMode(current => (current === 'login' ? 'signup' : 'login'))
    setError(null)
    setInfo(null)
  }

  return (
    <div className="auth">
      <div className="auth__brand">
        <Logo size={72} />
        <h1 className="brand-word">
          NV<b>fit</b>
        </h1>
        <p className="muted">Log your workouts day by day and see whether you are getting stronger.</p>
      </div>

      <form className="auth__form" onSubmit={handleSubmit}>
        <label className="label">
          Email
          <input className="field" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="label">
          Password
          <input
            className="field"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="form-message" role="status">
            {info}
          </p>
        )}
        <button type="submit" className="btn btn--accent btn--block" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <button type="button" className="link-btn" onClick={toggleMode}>
        {mode === 'login' ? 'No account yet? Sign up' : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}

import { Logo } from '../components/Icons'

export default function SetupNotice() {
  return (
    <div className="auth">
      <div className="auth__brand">
        <Logo size={56} />
        <h1 className="brand-word">
          NV<b>fit</b>
        </h1>
      </div>
      <div className="card">
        <h2 className="card__title">Supabase settings are missing</h2>
        <p className="muted">
          In the <code>NVfitFE</code> folder create a <code>.env.local</code> file (copy <code>.env.example</code>), fill in the
          Project URL and the Publishable key from the Supabase dashboard, then restart <code>npm run dev</code>.
        </p>
      </div>
    </div>
  )
}

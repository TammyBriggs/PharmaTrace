import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, ShieldPlus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const field =
  'h-11 w-full rounded-lg border border-line bg-white p-3 text-sm text-ink outline-none ' +
  'placeholder:text-mute/70 focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: { pathname: string } } };
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/overview" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(contact, password, remember);
      nav(loc.state?.from?.pathname ?? '/overview', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-canvas p-4">
      <form onSubmit={onSubmit} noValidate
        className="flex w-[456px] max-w-full flex-col gap-7 rounded-xl border border-line bg-white p-10 shadow-card">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-8 items-center justify-center rounded-lg bg-brand-tint">
            <ShieldPlus size={24} className="text-brand" aria-hidden />
          </div>
          <span className="text-xl font-semibold">PharmaTrace</span>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-bold leading-normal">Welcome back</h1>
          <p className="text-sm text-mute">Sign in to your regulatory workspace.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-semibold">Email address</label>
          <input id="email" type="email" autoComplete="username" required className={field}
            placeholder="name@organisation.rw" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-semibold">Password</label>
          <div className="relative">
            <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" required
              className={`${field} pr-11`} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand">
              {show ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
              className="size-4 accent-brand" />
            Remember me
          </label>
          {/* Wired to the password-reset flow in Milestone 4 */}
          <span className="font-semibold text-brand">Forgot password?</span>
        </div>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        <button type="submit" disabled={busy || !contact || !password}
          className="h-11 w-full rounded-lg bg-brand text-sm font-semibold text-white transition
                     hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-xs text-mute">For authorised regulators and administrators only.</p>
      </form>

      <div className="flex flex-col items-center gap-2 text-xs">
        <ShieldCheck size={20} className="text-brand" aria-hidden />
        <p>Rwanda Food and Drugs Authority</p>
        <p className="text-mute">Protecting the integrity of Rwanda’s medicine supply.</p>
      </div>
    </div>
  );
}

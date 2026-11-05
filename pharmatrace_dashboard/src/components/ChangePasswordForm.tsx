import { useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, Circle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { PASSWORD_RULES, passwordOk } from '../lib/password';
import { btnPrimary } from './Modal';

const field =
  'h-11 w-full rounded-lg border border-line bg-white p-3 pr-11 text-sm text-ink outline-none ' +
  'placeholder:text-mute/70 focus:border-brand focus:ring-2 focus:ring-brand/20';

/** Used on the forced "choose a new password" screen and in the account menu. */
export default function ChangePasswordForm({ currentLabel, onDone }: { currentLabel: string; onDone?: () => void }) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mismatch = again.length > 0 && again !== next;
  const ready = !!current && passwordOk(next) && next === again && next !== current;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await changePassword(current, next);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password. Please try again.');
    } finally { setBusy(false); }
  }

  const eye = (
    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide passwords' : 'Show passwords'}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-brand">
      {show ? <Eye size={18} /> : <EyeOff size={18} />}
    </button>
  );
  const type = show ? 'text' : 'password';

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="pw-current" className="text-sm font-semibold">{currentLabel}</label>
        <div className="relative">
          <input id="pw-current" type={type} autoComplete="current-password" className={field} value={current} onChange={(e) => setCurrent(e.target.value)} />
          {eye}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="pw-new" className="text-sm font-semibold">New password</label>
        <input id="pw-new" type={type} autoComplete="new-password" className={field} value={next} onChange={(e) => setNext(e.target.value)} />
        <ul className="flex flex-col gap-1 text-xs" aria-label="Password rules">
          {PASSWORD_RULES.map((r) => {
            const ok = r.ok(next);
            return (
              <li key={r.key} className={`flex items-center gap-1.5 ${ok ? 'text-brand' : 'text-mute'}`}>
                {ok ? <Check size={14} aria-hidden /> : <Circle size={14} aria-hidden />} {r.label}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="pw-again" className="text-sm font-semibold">Repeat the new password</label>
        <input id="pw-again" type={type} autoComplete="new-password" className={field} value={again} onChange={(e) => setAgain(e.target.value)} />
        {mismatch && <p className="text-xs text-danger">The two passwords do not match.</p>}
        {next && next === current && <p className="text-xs text-danger">Choose a password that is different from the current one.</p>}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={busy || !ready} className={`${btnPrimary} h-11 w-full`}>{busy ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}

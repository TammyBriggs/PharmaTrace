import { useState, type FormEvent } from 'react';
import { Check, Circle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { PASSWORD_RULES, passwordOk } from '../lib/password';
import { btnPrimary } from './Modal';
import PasswordInput from './PasswordInput';

/** Used on the forced "choose a new password" screen and in the account menu. */
export default function ChangePasswordForm({ currentLabel, onDone }: { currentLabel: string; onDone?: () => void }) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
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

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="pw-current" className="text-sm font-semibold">{currentLabel}</label>
        <PasswordInput id="pw-current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="pw-new" className="text-sm font-semibold">New password</label>
        <PasswordInput id="pw-new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
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
        <PasswordInput id="pw-again" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        {mismatch && <p className="text-xs text-danger">The two passwords do not match.</p>}
        {next && next === current && <p className="text-xs text-danger">Choose a password that is different from the current one.</p>}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={busy || !ready} className={`${btnPrimary} h-11 w-full`}>{busy ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}

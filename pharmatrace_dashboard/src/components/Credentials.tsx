import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';

/** A new login, shown once. The password is not stored anywhere readable, so this is the only chance to copy it. */
export default function Credentials({ contact, password, emailSent }: { contact: string; password: string; emailSent: boolean }) {
  const [copied, setCopied] = useState<'email' | 'password' | null>(null);
  async function copy(what: 'email' | 'password', value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(what); setTimeout(() => setCopied(null), 2000); } catch { /* the text can still be selected by hand */ }
  }
  const row = (label: string, value: string, what: 'email' | 'password', mono = false) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-mute">{label}</div>
        <div className={`truncate text-sm font-semibold ${mono ? 'select-all font-mono tracking-wide' : ''}`}>{value}</div>
      </div>
      <button type="button" onClick={() => copy(what, value)} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-brand hover:underline">
        {copied === what ? <><Check size={14} aria-hidden /> Copied</> : <><Copy size={14} aria-hidden /> Copy</>}
      </button>
    </div>
  );
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-canvas p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound size={16} className="text-brand" aria-hidden /> Sign-in details</div>
      {row('Email or phone', contact, 'email')}
      {row('Temporary password', password, 'password', true)}
      <p className="text-xs text-mute">
        <b className="text-ink">Shown once.</b>{' '}
        {emailSent ? 'It was also emailed to them. ' : 'Email is not set up, so pass it on securely (in person or a private message). '}
        They must choose their own password the first time they sign in.
      </p>
    </div>
  );
}

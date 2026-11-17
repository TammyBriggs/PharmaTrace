import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CircleCheck, ShieldPlus } from 'lucide-react';
import { api } from '../lib/api';
import { LanguageSwitch, useI18n } from '../i18n';
import { PASSWORD_RULES, passwordOk } from '../lib/password';
import { btnPrimary } from '../components/Modal';
import PasswordInput from '../components/PasswordInput';

const field =
  'h-11 w-full rounded-lg border border-line bg-white p-3 text-sm text-ink outline-none ' +
  'placeholder:text-mute/70 focus:border-brand focus:ring-2 focus:ring-brand/20';

type Step = 'email' | 'code' | 'done';

export default function ForgotPassword() {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setError(null); setBusy(true);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : t('fp.error')); } finally { setBusy(false); }
  }

  const sendCode = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ contact: email.trim() }) });
    setStep('code');
  }); };

  const reset = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ contact: email.trim(), code: code.trim(), newPassword: pw }) });
    setStep('done');
  }); };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas p-4">
      <LanguageSwitch />
      <div className="flex w-[456px] max-w-full flex-col gap-6 rounded-xl border border-line bg-white p-6 shadow-card sm:p-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-8 items-center justify-center rounded-lg bg-brand-tint"><ShieldPlus size={24} className="text-brand" aria-hidden /></div>
          <span className="text-xl font-semibold">PharmaTrace</span>
        </div>

        {step === 'email' && (
          <form onSubmit={sendCode} noValidate className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold leading-normal sm:text-[28px]">{t('fp.title')}</h1>
              <p className="text-sm text-mute">{t('fp.intro')}</p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="fp-email" className="text-sm font-semibold">{t('login.email')}</label>
              <input id="fp-email" type="email" autoComplete="username" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.emailPlaceholder')} />
            </div>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={busy || !email.includes('@')} className={`${btnPrimary} h-11 w-full`}>{busy ? t('fp.sending') : t('fp.send')}</button>
            <p className="text-xs text-mute">{t('fp.noCode')}</p>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={reset} noValidate className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold leading-normal sm:text-[28px]">{t('fp.codeTitle')}</h1>
              <p className="text-sm text-mute">{t('fp.codeIntro', { email })}</p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="fp-code" className="text-sm font-semibold">{t('fp.code')}</label>
              <input id="fp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={`${field} font-mono tracking-[0.3em]`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="fp-pw" className="text-sm font-semibold">{t('pw.new')}</label>
              <PasswordInput id="fp-pw" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <p className="text-xs text-mute">{PASSWORD_RULES.map((r) => t(r.labelKey)).join(' · ')}</p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="fp-again" className="text-sm font-semibold">{t('pw.repeat')}</label>
              <PasswordInput id="fp-again" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
              {again && again !== pw && <p className="text-xs text-danger">{t('pw.mismatch')}</p>}
            </div>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={busy || code.length !== 6 || !passwordOk(pw) || pw !== again} className={`${btnPrimary} h-11 w-full`}>{busy ? t('fp.saving') : t('fp.setNew')}</button>
            <button type="button" onClick={() => { setStep('email'); setError(null); }} className="text-sm font-semibold text-brand hover:underline">{t('fp.resend')}</button>
          </form>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-start gap-4">
            <CircleCheck size={40} className="text-brand" aria-hidden />
            <h1 className="text-2xl font-bold leading-normal sm:text-[28px]">{t('fp.doneTitle')}</h1>
            <p className="text-sm text-mute">{t('fp.doneBody')}</p>
            <Link to="/login" className={`${btnPrimary} flex h-11 w-full items-center justify-center`}>{t('fp.goSignIn')}</Link>
          </div>
        )}
      </div>
      {step !== 'done' && (
        <Link to="/login" className="flex items-center gap-2 text-sm font-semibold text-brand hover:underline"><ArrowLeft size={16} aria-hidden /> {t('fp.back')}</Link>
      )}
    </div>
  );
}

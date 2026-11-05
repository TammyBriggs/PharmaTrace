import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const base =
  'h-11 w-full rounded-lg border border-line bg-white p-3 pr-11 text-sm text-ink outline-none ' +
  'placeholder:text-mute/70 focus:border-brand focus:ring-2 focus:ring-brand/20';

/** A password box with an eye button: tap once to see what you typed, tap again to hide it. */
export default function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={base} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand">
        {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  );
}

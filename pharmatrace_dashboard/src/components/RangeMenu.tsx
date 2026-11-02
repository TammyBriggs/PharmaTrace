import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { btnSecondary } from './Modal';

/** A secondary button that opens a small single-choice menu (used for date ranges). */
export default function RangeMenu<K extends string>({ value, onChange, label, options }: {
  value: K; onChange: (k: K) => void; label: string; options: { key: K; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`${btnSecondary} flex items-center gap-2`}>
        <CalendarDays size={16} aria-hidden /> {label}
      </button>
      {open && (
        <ul role="listbox" aria-label="Date range" className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-card">
          {options.map((o) => (
            <li key={o.key} role="option" aria-selected={value === o.key}>
              <button type="button" onClick={() => { onChange(o.key); setOpen(false); }}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-canvas">
                {o.label} {value === o.key && <Check size={16} className="text-brand" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

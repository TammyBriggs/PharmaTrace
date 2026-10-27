import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, subtitle, onClose, busy = false, children }: {
  title: string; subtitle?: string; onClose: () => void; busy?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,select,button:not([data-close])')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [busy, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(17,24,39,0.4)] p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title"
        className="flex w-[568px] max-w-full flex-col gap-6 rounded-xl bg-white p-8 shadow-[0_16px_48px_0_rgba(17,24,39,0.1)]">
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h2 id="modal-title" className="text-2xl font-bold">{title}</h2>
            {subtitle && <p className="text-sm text-mute">{subtitle}</p>}
          </div>
          <button type="button" data-close aria-label="Close" disabled={busy} onClick={onClose}
            className="text-brand disabled:opacity-40"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const btnPrimary =
  'h-10 rounded-lg border border-brand bg-brand px-4 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60';
export const btnSecondary =
  'h-10 rounded-lg border border-brand bg-white px-4 text-sm font-semibold text-brand hover:bg-brand-tint disabled:cursor-not-allowed disabled:opacity-60';
export const btnDanger =
  'h-10 rounded-lg border border-danger bg-danger px-4 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60';

import type { ReactNode } from 'react';
import { Ban, CircleCheck, CircleHelp, Clock3, Copy, ShieldAlert, TriangleAlert, type LucideIcon } from 'lucide-react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-white p-5 shadow-card ${className}`}>{children}</section>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-line/70 ${className}`} />;
}

export type ChipKind = 'approved' | 'authentic' | 'flagged' | 'expired' | 'pending' | 'revoked' | 'not_found' | 'duplicate';

// Class strings are written out in full so Tailwind can see them.
const CHIP: Record<ChipKind, { label: string; cls: string; Icon: LucideIcon }> = {
  approved: { label: 'Approved', cls: 'bg-[#f0fdfa] text-[#0f766e]', Icon: CircleCheck },
  authentic: { label: 'Authentic', cls: 'bg-[#f0fdfa] text-[#0f766e]', Icon: CircleCheck },
  flagged: { label: 'Flagged', cls: 'bg-[#fef2f2] text-[#b91c1c]', Icon: ShieldAlert },
  expired: { label: 'Expired', cls: 'bg-[#fffbeb] text-[#b45309]', Icon: Clock3 },
  pending: { label: 'Pending', cls: 'bg-[#fffbeb] text-[#b45309]', Icon: Clock3 },
  revoked: { label: 'Revoked', cls: 'bg-[#fef2f2] text-[#b91c1c]', Icon: Ban },
  not_found: { label: 'Not found', cls: 'bg-[#f3f4f6] text-mute', Icon: CircleHelp },
  duplicate: { label: 'Duplicate', cls: 'bg-[#fef2f2] text-[#b91c1c]', Icon: Copy },
};

export function StatusChip({ kind }: { kind: ChipKind }) {
  const { label, cls, Icon } = CHIP[kind];
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap ${cls}`}>
      <Icon size={14} aria-hidden /> {label}
    </span>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-line bg-white p-6">
      <div className="flex items-center gap-2 font-semibold text-danger"><TriangleAlert size={18} /> Could not load this page</div>
      <p className="text-sm text-mute">{message}</p>
      <button onClick={onRetry} className="h-10 rounded-lg border border-brand px-4 text-sm font-semibold text-brand">Try again</button>
    </div>
  );
}

export function PageHeading({ title, subtitle, right }: { title: string; subtitle: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold leading-normal">{title}</h1>
        <p className="text-sm text-mute">{subtitle}</p>
      </div>
      {right}
    </div>
  );
}

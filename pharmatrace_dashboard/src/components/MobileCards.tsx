import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from './ui';

// The list pages show a table from the xl breakpoint (1280px) up, because the sidebar leaves too little width for six columns before that. Below it the same rows are shown as cards,
// built from the same data and wired to the same handlers, so nothing in the logic changes.

export function CardList({ children, dim = false }: { children: ReactNode; dim?: boolean }) {
  return <ul className={`grid grid-cols-1 gap-3 bg-canvas p-3 sm:grid-cols-2 xl:hidden ${dim ? 'opacity-60' : ''}`}>{children}</ul>;
}

export function CardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-1 gap-3 bg-canvas p-3 sm:grid-cols-2 xl:hidden" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
          <div className="flex justify-between gap-3"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-5 w-20" /></div>
          <Skeleton className="h-3 w-3/5" />
          <div className="grid grid-cols-2 gap-3"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
        </li>
      ))}
    </ul>
  );
}

export interface CardField { label: string; value: ReactNode; wide?: boolean; mono?: boolean }

/** One record. `title` may be a link; `badge` sits at the top right; `actions` are touch-sized buttons at the bottom. */
export function RecordCard({ title, to, mono = false, subtitle, badge, fields, actions, tint = false }: {
  title: ReactNode; to?: string; mono?: boolean; subtitle?: ReactNode; badge?: ReactNode;
  fields?: CardField[]; actions?: ReactNode; tint?: boolean;
}) {
  const heading = `min-w-0 break-words text-base font-semibold leading-snug ${mono ? 'font-mono text-[15px]' : ''}`;
  return (
    <li className={`flex flex-col gap-3 rounded-xl border p-4 ${tint ? 'border-brand/30 bg-brand-tint' : 'border-line bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {to ? <Link to={to} className={`${heading} hover:text-brand`}>{title}</Link> : <p className={heading}>{title}</p>}
          {subtitle && <p className="break-words text-xs text-mute">{subtitle}</p>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {fields && fields.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {fields.map((f) => (
            <div key={f.label} className={`min-w-0 ${f.wide ? 'col-span-2' : ''}`}>
              <dt className="text-xs text-mute">{f.label}</dt>
              <dd className={`mt-0.5 break-words ${f.mono ? 'font-mono text-xs' : ''}`}>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className="-mb-1 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-2 text-sm font-semibold">{actions}</div>}
    </li>
  );
}

/** Text-style action with a 44px-high tap area, for the bottom row of a card. */
export const cardAction = 'inline-flex min-h-11 items-center gap-1.5 hover:underline';

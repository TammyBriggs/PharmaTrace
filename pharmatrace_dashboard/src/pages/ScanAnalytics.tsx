import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Info } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { num } from '../lib/format';
import { RANGES, type AnalyticsData, type RangeKey, type SuspiciousCard } from '../lib/analytics';
import { Card, ErrorState, PageHeading, Skeleton, StatusChip } from '../components/ui';
import RangeMenu from '../components/RangeMenu';

const TONE = {
  high: { bg: 'bg-[#fef2f2]', chip: 'high_risk' as const },
  under_review: { bg: 'bg-[#fffbeb]', chip: 'under_review' as const },
  review: { bg: 'bg-[#fffbeb]', chip: 'needs_review' as const },
};

export default function ScanAnalytics() {
  const [range, setRange] = useState<RangeKey>('today');
  const { data, error, loading, reload } = useApi<AnalyticsData>(`/overview/analytics?range=${range}`);
  const first = loading && !data;
  const max = data ? Math.max(1, ...data.sectors.map((s) => s.count)) : 1;
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;

  const metrics: [string, number | undefined][] = [
    ['Total scans', data?.totals.total], ['Active sectors', data?.totals.sectors], ['Suspicious batches', data?.totals.suspiciousBatches],
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Scan Analytics" subtitle="Understand verification activity and spot unusual patterns in Gasabo District, Kigali."
        right={<RangeMenu value={range} onChange={setRange} label={data?.dateLabel ?? rangeLabel} options={RANGES} />} />

      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
            {metrics.map(([label, n]) => (
              <Card key={label} className="flex flex-col gap-2 !p-3 sm:gap-4 sm:!p-5">
                <p className="text-xs text-mute sm:text-sm">{label}</p>
                {n === undefined ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold leading-normal sm:text-[28px]">{num(n)}</p>}
              </Card>
            ))}
          </div>

          <div className={`grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.4fr_1fr] ${loading && data ? 'opacity-60' : ''}`}>
            <Card className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Scans by Gasabo sector</h2>
              <p className="text-xs text-mute">
                {range === 'today' ? 'Today’s scan distribution' : `Scan distribution · ${rangeLabel.toLowerCase()}`} · All drug categories
              </p>
              {first ? (
                <div className="flex flex-col gap-[10px]">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-3 w-full" />)}</div>
              ) : data && data.sectors.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <p className="font-semibold">No scans in this period</p>
                  <p className="text-sm text-mute">Scans from the public verify page and the pharmacist app appear here.</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-[10px]" aria-label="Scans by sector">
                  {data?.sectors.map((s) => (
                    <li key={s.sector ?? '—'} className="flex items-center gap-3 text-xs">
                      <span className="w-[100px] shrink-0 truncate" title={s.sector ?? 'Public scans with no sector'}>{s.sector ?? 'Public scans'}</span>
                      <div className="h-3 min-w-0 flex-1 overflow-hidden rounded bg-[#f3f4f6]" role="img" aria-label={`${s.count} scans`}>
                        <div className="h-3 rounded bg-brand" style={{ width: `${Math.max(2, (s.count / max) * 100)}%` }} />
                      </div>
                      <span className="w-10 shrink-0 font-semibold">{num(s.count)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-mute">Source: public and facility verification scans · CAT (UTC+2)</p>
            </Card>

            <div className="flex flex-col gap-6">
              <Card className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold">Suspicious activity</h2>
                <p className="text-sm text-mute">Signals for review, not automatic counterfeit decisions.</p>
                {first ? (
                  <><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" /></>
                ) : data && data.suspicious.length === 0 ? (
                  <div className="flex items-start gap-3 rounded-lg bg-brand-tint p-4 text-sm text-brand">
                    <CircleCheck size={20} className="shrink-0" aria-hidden />
                    <p>No unusual patterns in this period. A burst is flagged at {data.burstMin}+ scans of one batch in an hour.</p>
                  </div>
                ) : data?.suspicious.map((c) => <Suspicious key={c.batchId} c={c} />)}
              </Card>
              <Card>
                <div className="flex items-start gap-3">
                  <Info size={20} className="shrink-0 text-brand" aria-hidden />
                  <p className="text-xs text-mute">Location signals may reflect distribution activity. Check facility details before taking action.</p>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Suspicious({ c }: { c: SuspiciousCard }) {
  const t = TONE[c.risk];
  return (
    <div className={`flex flex-col gap-3 rounded-lg p-4 ${t.bg}`}>
      <StatusChip kind={t.chip} />
      <p className="font-mono text-sm font-bold">{c.batchNo}</p>
      <p className="text-sm font-semibold">{c.title}</p>
      <p className="text-xs text-mute">{c.drug} · {c.detail}</p>
      <Link to={c.link === 'report' ? `/flag-reports?q=${encodeURIComponent(c.batchNo)}` : `/batches/${c.batchId}`}
        className="text-xs font-semibold text-brand hover:underline">
        {c.link === 'report' ? 'View flag report →' : 'Review batch →'}
      </Link>
    </div>
  );
}

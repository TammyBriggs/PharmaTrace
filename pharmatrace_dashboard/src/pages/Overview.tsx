import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, ShieldCheck, type LucideIcon, Building2, Clock3, ScanLine, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../lib/useApi';
import type { OverviewData, VerdictKey } from '../lib/types';
import { categoryLabel, fmtDay, num } from '../lib/format';
import { Card, ErrorState, PageHeading, Skeleton, StatusChip } from '../components/ui';

const VERDICT_COLOR: Record<VerdictKey, string> = {
  authentic: '#0f766e', flagged: '#b91c1c', expired: '#b45309',
  pending: '#f59e0b', revoked: '#7f1d1d', not_found: '#9ca3af',
};
const VERDICT_LABEL: Record<VerdictKey, string> = {
  authentic: 'Authentic', flagged: 'Flagged', expired: 'Expired',
  pending: 'Pending', revoked: 'Revoked', not_found: 'Not found',
};
// Figma lists these four; pending/revoked appear only when there is something to show.
const ALWAYS: VerdictKey[] = ['authentic', 'flagged', 'expired', 'not_found'];

function niceStep(raw: number) {
  if (raw <= 1) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

function LineChart({ points }: { points: { date: string; count: number }[] }) {
  const max = Math.max(0, ...points.map((p) => p.count));
  const step = niceStep(max / 3);
  const top = step * 3;
  const ticks = [top, step * 2, step, 0];
  const W = 610, H = 156;
  const x = (i: number) => (i / Math.max(1, points.length - 1)) * W;
  const y = (v: number) => H - (v / top) * (H - 4) - 2;
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(' ');
  const labelIdx = [0, 7, 14, 21, points.length - 1].filter((i) => i < points.length);

  return (
    <div>
      <div className="flex gap-3">
        <div className="flex h-39 w-10 flex-col justify-between text-right text-xs text-mute" aria-hidden>
          {ticks.map((t) => <span key={t}>{num(t)}</span>)}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-39 min-w-0 flex-1"
          role="img" aria-label={`Scans per day, ${num(points.reduce((s, p) => s + p.count, 0))} in total`}>
          {ticks.map((t) => (
            <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="#e5e7eb" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={d} fill="none" stroke="#0f766e" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="ml-[52px] mt-2 flex justify-between text-xs text-mute">
        {labelIdx.map((i) => <span key={i}>{fmtDay(points[i].date, false)}</span>)}
      </div>
    </div>
  );
}

function Donut({ verdicts }: { verdicts: OverviewData['verdicts'] }) {
  const R = 72, C = 2 * Math.PI * R;
  const keys = (Object.keys(VERDICT_LABEL) as VerdictKey[]).filter((k) => verdicts[k] > 0);
  let offset = 0;
  const pct = verdicts.total ? ((verdicts.authentic / verdicts.total) * 100).toFixed(1) : null;
  return (
    <div className="relative size-40 shrink-0">
      <svg viewBox="0 0 160 160" className="size-40 -rotate-90" aria-hidden>
        <circle cx="80" cy="80" r={R} fill="none" stroke="#e5e7eb" strokeWidth="16" />
        {keys.map((k) => {
          const len = (verdicts[k] / verdicts.total) * C;
          const el = (
            <circle key={k} cx="80" cy="80" r={R} fill="none" stroke={VERDICT_COLOR[k]} strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{pct ? `${pct}%` : '—'}</span>
        <span className="text-xs text-mute">Authentic</span>
      </div>
    </div>
  );
}

function Kpi({ label, value, note, Icon, loading }: {
  label: string; value: string; note: string; Icon: LucideIcon; loading: boolean;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-mute">
        {label} <Icon size={20} className="text-brand" aria-hidden />
      </div>
      {loading ? <><Skeleton className="h-9 w-24" /><Skeleton className="h-3 w-32" /></> : (
        <><div className="text-[32px] font-bold leading-none">{value}</div><div className="text-xs text-mute">{note}</div></>
      )}
    </Card>
  );
}

export default function Overview() {
  const { user } = useAuth();
  const isManufacturer = user?.role === 'manufacturer';
  const { data, error, loading, reload } = useApi<OverviewData>(isManufacturer ? null : '/overview');

  if (isManufacturer) {
    return <PageHeading title="Overview" subtitle="Your manufacturer workspace opens up with the Batches module." />;
  }

  const pts = data?.scansOverTime.points ?? [];
  const k = data?.kpis;
  const catMax = Math.max(1, ...(data?.categories.map((c) => c.count) ?? []));

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Overview" subtitle="Supply chain integrity across Rwanda"
        right={
          <div className="flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm">
            <CalendarDays size={16} className="text-brand" aria-hidden /> {fmtDay(new Date())}
          </div>
        } />

      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Kpi loading={loading} Icon={Building2} label="Active manufacturers"
              value={num(k?.manufacturers.active ?? 0)} note={`${num(k?.manufacturers.thisMonth ?? 0)} registered this month`} />
            <Kpi loading={loading} Icon={Clock3} label="Approved batches"
              value={num(k?.batches.approved ?? 0)} note={`${num(k?.batches.pending ?? 0)} awaiting review`} />
            <Kpi loading={loading} Icon={ShieldAlert} label="Flagged batches"
              value={num(k?.batches.flagged ?? 0)} note={`${num(k?.openInvestigations ?? 0)} open investigations`} />
            <Kpi loading={loading} Icon={ScanLine} label="Scans today"
              value={num(k?.scansToday.total ?? 0)} note={`Across ${num(k?.scansToday.sectors ?? 0)} sectors`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
            <Card className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Scans over time</h2>
                  <p className="text-xs text-mute">
                    {pts.length ? `${fmtDay(pts[0].date, false)} – ${fmtDay(pts[pts.length - 1].date)}` : 'Last 30 days'}
                  </p>
                </div>
                {data && <span className="text-sm font-semibold text-brand">{num(data.scansOverTime.total)} scans</span>}
              </div>
              {loading ? <Skeleton className="h-44 w-full" /> : <LineChart points={pts} />}
              {data && data.scansOverTime.total === 0 && (
                <p className="text-sm text-mute">No scans recorded in this period yet.</p>
              )}
            </Card>

            <Card className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Verification results</h2>
              <p className="-mt-3 text-xs text-mute">Last 30 days</p>
              {loading || !data ? <Skeleton className="h-40 w-full" /> : (
                <div className="flex items-center gap-6">
                  <Donut verdicts={data.verdicts} />
                  <ul className="flex flex-1 flex-col gap-3 text-sm">
                    {(Object.keys(VERDICT_LABEL) as VerdictKey[])
                      .filter((v) => ALWAYS.includes(v) || data.verdicts[v] > 0)
                      .map((v) => (
                        <li key={v} className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2">
                            <i className="size-2.5 rounded-full" style={{ background: VERDICT_COLOR[v] }} aria-hidden />
                            {VERDICT_LABEL[v]}
                          </span>
                          <b>{num(data.verdicts[v])}</b>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <Card className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Scans by drug category</h2>
              <p className="-mt-3 text-xs text-mute">Today</p>
              {loading ? <Skeleton className="h-32 w-full" /> : data && data.categories.length > 0 ? (
                <ul className="flex flex-col gap-4">
                  {data.categories.map((c) => (
                    <li key={c.category} className="flex flex-col gap-1.5 text-sm">
                      <div className="flex justify-between"><span>{categoryLabel(c.category)}</span><b>{num(c.count)}</b></div>
                      <div className="h-2 rounded-full bg-line">
                        <div className="h-2 rounded-full bg-brand" style={{ width: `${(c.count / catMax) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-mute">No scans recorded today.</p>}
            </Card>

            <Card className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent alerts</h2>
                <Link to="/flag-reports" className="text-sm font-semibold text-brand">View all</Link>
              </div>
              {loading ? <Skeleton className="h-32 w-full" /> : data && data.alerts.length > 0 ? (
                <ul className="flex flex-col divide-y divide-line">
                  {data.alerts.map((a, i) => (
                    <li key={i} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                      <StatusChip kind={a.kind} />
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="truncate">
                          <span className="font-mono text-xs font-bold">{a.batchNo ?? 'Unknown batch'}</span>
                          {a.drug && <span className="text-mute"> · {a.drug}</span>}
                        </div>
                        <div className="truncate text-xs text-mute">{a.detail} · {a.time}</div>
                      </div>
                      <Link to="/batches" aria-label="Open batches" className="text-brand"><ArrowUpRight size={18} /></Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-2 text-sm text-mute">
                  <ShieldCheck size={18} className="text-brand" aria-hidden /> No alerts in the last 7 days.
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

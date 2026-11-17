import { Link } from 'react-router-dom';
import { CalendarDays, CircleCheck, Layers, Pill, ScanLine, ShieldAlert, Clock3, type LucideIcon } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { chipFor, fmtDateTime } from '../lib/batches';
import { fmtDay, num } from '../lib/format';
import { ago } from '../lib/notifications';
import { EVENT_LABEL, type MyOverview } from '../lib/manufacturers';
import { useI18n, type Key } from '../i18n';
import { Card, ErrorState, PageHeading, Skeleton, StatusChip } from '../components/ui';

const VERDICTS: [string, string][] = [
  ['authentic', '#0f766e'], ['flagged', '#b91c1c'], ['expired', '#b45309'],
  ['duplicate', '#ef4444'], ['not_found', '#9ca3af'],
];

function Kpi({ label, value, note, Icon, loading }: { label: string; value: number; note: string; Icon: LucideIcon; loading: boolean }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-mute">{label}<Icon size={20} className="text-brand" aria-hidden /></div>
      {loading ? <><Skeleton className="h-9 w-20" /><Skeleton className="h-3 w-28" /></> : (
        <><div className="text-[32px] font-bold leading-none">{num(value)}</div><div className="text-xs text-mute">{note}</div></>
      )}
    </Card>
  );
}

function Bars({ points }: { points: { date: string; count: number }[] }) {
  const { t } = useI18n();
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <div>
      <div className="flex h-36 items-end gap-1.5" role="img" aria-label={t('ov.perDay', { n: num(points.reduce((s, p) => s + p.count, 0)) })}>
        {points.map((p) => (
          <div key={p.date} className="group relative flex h-full flex-1 items-end" title={`${fmtDay(p.date, false)}: ${t('ov.scansTotal', { n: num(p.count) })}`}>
            <div className="w-full rounded-t bg-brand" style={{ height: `${p.count ? Math.max(4, (p.count / max) * 100) : 0}%` }} />
            {p.count === 0 && <div className="h-0.5 w-full bg-line" />}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-mute">
        <span>{fmtDay(points[0].date, false)}</span><span>{fmtDay(points[points.length - 1].date, false)}</span>
      </div>
    </div>
  );
}

export default function ManufacturerOverview() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useApi<MyOverview>('/overview/manufacturer');
  const s = data?.stats;
  const v = data?.verdicts;
  const nothingToDo = data && data.attention.flagged.length === 0 && data.attention.expiring.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title={t('ov.title')} subtitle={data ? `${data.manufacturer.name} · ${data.manufacturer.country}` : t('mo.subtitleFallback')}
        right={<div className="flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm">
          <CalendarDays size={16} className="text-brand" aria-hidden /> {fmtDay(new Date())}</div>} />

      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          {data && data.manufacturer.status !== 'active' && (
            <div role="status" className="flex items-center gap-2 rounded-xl border border-line bg-[#fffbeb] p-4 text-sm text-[#b45309]">
              <Clock3 size={18} aria-hidden />
              {data.manufacturer.status === 'pending' ? t('mo.pendingBanner') : t('mo.revokedBanner')}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">
            <Kpi loading={loading} Icon={Layers} label={t('mo.submitted')} value={s?.submitted ?? 0} note={t('ov.awaiting', { n: num(s?.pending ?? 0) })} />
            <Kpi loading={loading} Icon={CircleCheck} label={t('mo.approved')} value={s?.approved ?? 0} note={t('mo.flaggedRevoked', { f: num(s?.flagged ?? 0), r: num(s?.revoked ?? 0) })} />
            <Kpi loading={loading} Icon={Pill} label={t('mo.drugs')} value={s?.drugs ?? 0} note={t('mo.distinct')} />
            <Kpi loading={loading} Icon={ScanLine} label={t('mo.scansWeek')} value={data?.scans.week ?? 0}
              note={t('mo.todaySectors', { t: num(data?.scans.today ?? 0), s: num(data?.scans.sectors ?? 0) })} />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
            <Card className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold">{t('mo.scansOfYours')}</h2>
                <p className="text-xs text-mute">{t('mo.last14')}</p>
              </div>
              {loading || !data ? <Skeleton className="h-44 w-full" /> : <Bars points={data.scans.points} />}
            </Card>
            <Card className="flex flex-col gap-4">
              <div><h2 className="text-lg font-semibold">{t('ov.verification')}</h2><p className="text-xs text-mute">{t('common.last30')}</p></div>
              {loading || !v ? <Skeleton className="h-36 w-full" /> : v.total === 0 ? (
                <p className="text-sm text-mute">{t('mo.noOneScanned')}</p>
              ) : (
                <ul className="flex flex-col gap-3 text-sm">
                  {VERDICTS.filter(([k]) => (v[k] ?? 0) > 0 || k === 'authentic').map(([k, color]) => (
                    <li key={k} className="flex flex-col gap-1.5">
                      <div className="flex justify-between"><span className="flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />{t(`status.${k}` as Key)}</span><b>{num(v[k] ?? 0)}</b></div>
                      <div className="h-1.5 rounded-full bg-line"><div className="h-1.5 rounded-full" style={{ width: `${((v[k] ?? 0) / v.total) * 100}%`, background: color }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
            <Card className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">{t('mo.attention')}</h2>
              {loading || !data ? <Skeleton className="h-32 w-full" /> : nothingToDo ? (
                <p className="text-sm text-mute">{t('mo.nothing')}</p>
              ) : (
                <ul className="flex flex-col">
                  {data.attention.flagged.map((b) => (
                    <li key={b.id} className="flex items-start gap-3 border-t border-line py-3 first:border-0">
                      <ShieldAlert size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />
                      <div className="min-w-0 flex-1 text-sm">
                        <Link to={`/batches/${b.id}`} className="font-semibold hover:underline"><span className="font-mono text-xs">{b.batchNo}</span> · {b.drug}</Link>
                        <p className="text-mute">{b.status === 'flagged' ? t('mo.flaggedWord') : t('mo.revokedWord')}{b.reason ? `: ${b.reason}` : t('mo.byRegulator')}</p>
                      </div>
                      <StatusChip kind={chipFor({ status: b.status })} />
                    </li>
                  ))}
                  {data.attention.expiring.map((b) => (
                    <li key={b.id} className="flex items-start gap-3 border-t border-line py-3 first:border-0">
                      <Clock3 size={18} className="mt-0.5 shrink-0 text-[#b45309]" aria-hidden />
                      <div className="min-w-0 flex-1 text-sm">
                        <Link to={`/batches/${b.id}`} className="font-semibold hover:underline"><span className="font-mono text-xs">{b.batchNo}</span> · {b.drug}</Link>
                        <p className="text-mute">{b.days === 1 ? t('mo.expiresOne', { date: fmtDay(b.expiryDate) }) : t('mo.expires', { date: fmtDay(b.expiryDate), n: b.days })}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">{t('mo.activity')}</h2>
              {loading || !data ? <Skeleton className="h-32 w-full" /> : data.activity.length === 0 ? (
                <p className="text-sm text-mute">{t('mo.activityEmpty')}</p>
              ) : (
                <ul className="flex flex-col">
                  {data.activity.map((a, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 border-t border-line py-3 text-sm first:border-0">
                      <div className="min-w-0">
                        <Link to={`/batches/${a.batchId}`} className="font-semibold hover:underline"><span className="font-mono text-xs">{a.batchNo}</span> · {a.drug}</Link>
                        <p className="text-mute">{(EVENT_LABEL[a.event] ?? a.event).replace(/^./, (c) => c.toUpperCase())}{a.reason ? `: ${a.reason}` : ''}</p>
                      </div>
                      <time dateTime={a.at} title={fmtDateTime(a.at)} className="shrink-0 text-xs text-mute">{ago(a.at)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

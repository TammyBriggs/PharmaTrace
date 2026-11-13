import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Boxes, CircleCheck, Clock3, Layers, Pill, ShieldAlert, type LucideIcon } from 'lucide-react';
import { useApi } from '../lib/useApi';
import TxLink from '../components/TxLink';
import { chipFor, fmtDateTime, shortHash } from '../lib/batches';
import { fmtDay, num } from '../lib/format';
import type { MfProfile } from '../lib/manufacturers';
import { Card, ErrorState, Skeleton, StatusChip, type ChipKind } from '../components/ui';

const CHIP: Record<MfProfile['status'], ChipKind> = { active: 'approved', pending: 'pending', revoked: 'revoked' };

function Stat({ label, value, note, Icon, loading }: { label: string; value: number; note: string; Icon: LucideIcon; loading: boolean }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-mute">{label}<Icon size={20} className="text-brand" aria-hidden /></div>
      {loading ? <><Skeleton className="h-9 w-20" /><Skeleton className="h-3 w-28" /></> : (
        <><div className="text-[32px] font-bold leading-none">{num(value)}</div><div className="text-xs text-mute">{note}</div></>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-6">
      <dt className="w-40 shrink-0 text-sm text-mute">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

export default function ManufacturerDetail() {
  const { id } = useParams();
  const { data: m, error, loading, reload } = useApi<MfProfile>(`/manufacturers/${id}/profile`);
  const s = m?.stats;

  return (
    <div className="flex flex-col gap-6">
      <Link to="/manufacturers" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
        <ArrowLeft size={16} aria-hidden /> Manufacturers
      </Link>

      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            {loading || !m ? <Skeleton className="h-9 w-72" /> : (
              <>
                <h1 className="break-words text-2xl font-bold leading-normal sm:text-[28px]">{m.name}</h1>
                <StatusChip kind={CHIP[m.status]} />
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">
            <Stat loading={loading} Icon={Layers} label="Batches submitted" value={s?.submitted ?? 0} note="Production runs sent for review" />
            <Stat loading={loading} Icon={CircleCheck} label="Batches approved" value={s?.approved ?? 0}
              note={`${num(s?.pending ?? 0)} pending · ${num(s?.flagged ?? 0)} flagged · ${num(s?.revoked ?? 0)} revoked`} />
            <Stat loading={loading} Icon={Pill} label="Drugs" value={s?.drugs ?? 0} note="Distinct products across all batches" />
            <Stat loading={loading} Icon={Boxes} label="Packs registered" value={s?.packs ?? 0} note="Total quantity across batches" />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Card>
              <h2 className="mb-2 text-lg font-semibold">Details</h2>
              {loading || !m ? <Skeleton className="h-56 w-full" /> : (
                <dl>
                  <Row label="Licence number"><span className="font-mono text-xs">{m.licenseNumber}</span></Row>
                  <Row label="Wallet address"><span className="font-mono text-xs text-brand" title={m.wallet}>{m.wallet}</span></Row>
                  <Row label="Country">{m.country}</Row>
                  <Row label="Contact">{m.contact ?? <span className="text-mute">No account linked yet</span>}</Row>
                  <Row label="Registered">{fmtDateTime(m.createdAt)}</Row>
                  <Row label="Approved">{m.approvedAt ? fmtDay(m.approvedAt.slice(0, 10)) : <span className="text-mute">Not approved</span>}</Row>
                  {m.status === 'revoked' && m.revokedAt && <Row label="Revoked">{fmtDay(m.revokedAt.slice(0, 10))}</Row>}
                  {m.registerTxHash && <Row label="Approval transaction"><TxLink hash={m.registerTxHash} /></Row>}
                  {m.revokeTxHash && <Row label="Revocation transaction"><TxLink hash={m.revokeTxHash} /></Row>}
                </dl>
              )}
            </Card>

            <Card className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent batches</h2>
                {m && m.stats.submitted > 0 && <span className="text-xs text-mute">Latest {m.recentBatches.length} of {num(m.stats.submitted)}</span>}
              </div>
              {loading || !m ? <Skeleton className="h-56 w-full" /> : m.recentBatches.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Clock3 size={28} className="text-brand" aria-hidden />
                  <p className="font-semibold">No batches submitted yet</p>
                  <p className="text-sm text-mute">Batches appear here once this manufacturer submits one for review.</p>
                </div>
              ) : (
                <>
                <ul className="flex flex-col sm:hidden">
                  {m.recentBatches.map((b) => (
                    <li key={b.id} className="flex flex-col gap-1.5 border-t border-line py-3">
                      <div className="flex items-center justify-between gap-3">
                        <Link to={`/batches/${b.id}`} className="font-mono text-sm font-semibold text-brand hover:underline">{b.batchNo}</Link>
                        <StatusChip kind={chipFor({ status: b.status })} />
                      </div>
                      <p className="text-sm">{b.drug}</p>
                      <p className="text-xs text-mute">Expires {fmtDay(b.expiryDate)}</p>
                    </li>
                  ))}
                </ul>
                <table className="hidden w-full text-sm sm:table">
                  <thead><tr className="h-10 text-left text-xs font-semibold text-mute">
                    <th className="px-2">Batch</th><th className="px-2">Drug</th><th className="px-2">Status</th><th className="px-2 text-right">Expires</th>
                  </tr></thead>
                  <tbody>
                    {m.recentBatches.map((b) => (
                      <tr key={b.id} className="h-12 border-t border-line">
                        <td className="px-2"><Link to={`/batches/${b.id}`} className="font-mono text-xs font-semibold text-brand hover:underline">{b.batchNo}</Link></td>
                        <td className="px-2">{b.drug}</td>
                        <td className="px-2"><StatusChip kind={chipFor({ status: b.status })} /></td>
                        <td className="px-2 text-right text-mute">{fmtDay(b.expiryDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </>
              )}
              {m && m.stats.flagged > 0 && (
                <p className="mt-2 flex items-center gap-2 text-sm text-danger"><ShieldAlert size={16} aria-hidden /> {num(m.stats.flagged)} batch{m.stats.flagged === 1 ? '' : 'es'} currently flagged.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

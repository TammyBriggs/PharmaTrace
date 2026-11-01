import { useCallback, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ban, Check, CircleAlert, CircleCheck, Clock3, Download, Flag, MapPin, RotateCcw, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useApi } from '../lib/useApi';
import { useAuth } from '../auth/AuthContext';
import { shortAddr } from '../lib/wallet';
import { chipFor, explorerUrl, fmtDateTime, shortHash, type BatchContext, type BatchDetail as Detail, type BatchEvent, type BStatus, type EventKind } from '../lib/batches';
import { fmtDay, num } from '../lib/format';
import { Card, ErrorState, Skeleton, StatusChip, type ChipKind } from '../components/ui';
import { btnSecondary } from '../components/Modal';
import { useBatchActions, type ActionKind } from '../components/BatchActions';

const TITLE: Record<EventKind, string> = {
  submitted: 'Submitted', approved: 'Approved', flagged: 'Flagged', flag_resolved: 'Flag resolved', revoked: 'Revoked', reinstated: 'Reinstated',
};
const ICON: Record<EventKind, LucideIcon> = {
  submitted: Clock3, approved: CircleCheck, flagged: ShieldAlert, flag_resolved: ShieldCheck, revoked: Ban, reinstated: RotateCcw,
};

/** Status of the batch right after each event, replayed oldest first (mirrors the contract's restore rule). */
function statusAfter(events: BatchEvent[]): Map<BatchEvent, BStatus> {
  const out = new Map<BatchEvent, BStatus>();
  let approvedOnce = false;
  for (const e of events) {
    let s: BStatus;
    if (e.event === 'approved') { approvedOnce = true; s = 'approved'; }
    else if (e.event === 'flagged') s = 'flagged';
    else if (e.event === 'revoked') s = 'revoked';
    else if (e.event === 'submitted') s = 'pending';
    else s = approvedOnce ? 'approved' : 'pending';
    out.set(e, s);
  }
  return out;
}

function downloadQr(batchNo: string) {
  const svg = document.querySelector<SVGSVGElement>('#batch-qr svg');
  if (!svg) return;
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = c.height = 640;
    const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, 640, 640); g.drawImage(img, 0, 0, 640, 640);
    c.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${batchNo}-qr.png`; a.click();
      URL.revokeObjectURL(a.href); URL.revokeObjectURL(url);
    });
  };
  img.src = url;
}

export default function BatchDetail() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const isReg = user?.role === 'regulator' || user?.role === 'super_admin';
  const { data, error, loading, reload } = useApi<{ batch: Detail }>(`/batches/${id}`);
  const ctx = useApi<BatchContext>(isReg ? '/batches/context' : null);
  const [banner, setBanner] = useState<string | null>(null);

  const onDone = useCallback((d: { kind: string; batch: Detail; txHash: string }) => {
    setBanner(`Transaction confirmed: ${shortHash(d.txHash)}. This batch is now ${d.batch.status}.`);
    reload();
  }, [reload]);
  const actions = useBatchActions(ctx.data?.reasons ?? [], onDone);

  const crumb = <p className="text-xs text-brand"><Link to="/batches" className="hover:underline">Batches</Link> / Batch detail</p>;
  if (error) return <div className="flex flex-col gap-4">{crumb}<ErrorState message={error} onRetry={reload} /></div>;
  if (loading && !data) {
    return (
      <div className="flex flex-col gap-4">{crumb}
        <Skeleton className="h-9 w-64" /><Skeleton className="h-4 w-96" /><Skeleton className="h-14 w-full" />
        <div className="flex gap-6"><Skeleton className="h-80 w-80" /><Skeleton className="h-80 flex-1" /></div>
      </div>
    );
  }
  const b = data!.batch;
  const ref = { id: b.id, batchNo: b.batchNo, drugName: b.drugName };
  const after = statusAfter(b.events);
  const newest = [...b.events].reverse();

  const btn = (kind: ActionKind, label: string, Icon: LucideIcon, tone: 'primary' | 'danger') => (
    <button key={kind} onClick={() => actions.start(ref, kind)}
      className={`flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold hover:brightness-95 ${tone === 'primary'
        ? 'border-brand bg-brand text-white' : 'border-danger bg-white text-danger hover:bg-[#fef2f2]'}`}>
      <Icon size={16} aria-hidden /> {label}
    </button>
  );
  const buttons: ReactNode[] = !isReg ? [] : b.status === 'pending'
    ? [btn('flag', 'Flag as counterfeit', Flag, 'danger'), btn('approve', 'Approve', Check, 'primary')]
    : b.status === 'approved' ? [btn('flag', 'Flag as counterfeit', Flag, 'danger'), btn('revoke', 'Revoke batch', Ban, 'danger')]
    : b.status === 'flagged' ? [btn('revoke', 'Revoke batch', Ban, 'danger'), btn('resolve', 'Resolve flag', ShieldCheck, 'primary')]
    : [btn('reinstate', 'Reinstate batch', RotateCcw, 'primary')];

  const note =
    b.status === 'flagged' && b.flag ? { tone: 'red', text: `Flagged · ${b.flag.reason}. ${b.flag.notes}` }
    : b.status === 'revoked' && b.revoke ? { tone: 'red', text: `Revoked · ${b.revoke.reason}. ${b.revoke.notes}` }
    : b.status === 'pending' ? { tone: 'amber', text: isReg ? 'Pending review · This batch verifies as Pending until a regulator approves it.' : 'Pending review · A regulator must approve this batch before it verifies as authentic.' }
    : b.expired ? { tone: 'amber', text: 'This batch has passed its expiry date and now verifies as Expired.' } : null;

  const sectors = b.scans.bySector;
  return (
    <div className="flex flex-col gap-4">
      {crumb}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-mono text-[28px] font-bold leading-normal">{b.batchNo}</h1>
          <p className="text-sm text-mute">{b.drugName} · {b.category}</p>
        </div>
        <div className="flex gap-3">{buttons}</div>
      </div>

      {banner && (
        <div role="status" className="flex items-center gap-3 rounded-lg bg-brand-tint p-4 text-sm text-brand">
          <CircleCheck size={20} className="shrink-0" aria-hidden /><p className="flex-1">{banner}</p>
          <button onClick={() => setBanner(null)} className="font-semibold hover:underline">Dismiss</button>
        </div>
      )}
      {note && (
        <div className={`flex items-center gap-3 rounded-lg p-4 text-sm ${note.tone === 'red' ? 'bg-[#fef2f2] text-[#b91c1c]' : 'bg-[#fffbeb] text-[#b45309]'}`}>
          <CircleAlert size={20} className="shrink-0" aria-hidden /> {note.text}
        </div>
      )}

      <div className="grid grid-cols-2 items-start gap-6 md:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <Field label="Manufacturer" value={b.manufacturer.name} />
        <Field label="Licence" value={b.manufacturer.licenseNumber} />
        <Field label="Expiry date" value={fmtDay(b.expiryDate)} />
        <Field label="Quantity" value={`${num(b.quantity)} packs`} />
        <StatusChip kind={chipFor(b)} />
      </div>
      <div className="grid grid-cols-2 items-start gap-6 md:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <Field label="Manufacture date" value={fmtDay(b.mfgDate)} />
        <Field label="GTIN" value={b.gtin} mono />
        <Field label="Registration no." value={b.registrationNumber ?? '—'} mono />
        <Field label="Serials" value={`${num(b.serials.total)} · ${num(b.serials.dispensed)} dispensed`} />
        <span aria-hidden className="hidden md:block" />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex w-80 max-w-full shrink-0 flex-col gap-4">
          <h2 className="text-lg font-semibold">Batch QR</h2>
          <div id="batch-qr" className="flex justify-center"><QRCodeSVG value={b.link} size={160} level="M" marginSize={2} title={`QR code for batch ${b.batchNo}`} /></div>
          <p className="font-mono text-xs">{b.batchNo}</p>
          <button onClick={() => downloadQr(b.batchNo)} className={`${btnSecondary} flex w-fit items-center gap-2`}><Download size={16} aria-hidden /> Download QR</button>
          <p className="text-xs text-mute">Encodes this batch’s GS1 Digital Link: <span className="break-all font-mono">{b.link}</span>. Per-pack serial codes are generated separately.</p>
        </Card>

        <Card className="flex min-w-72 flex-1 flex-col gap-4">
          <h2 className="text-lg font-semibold">Provenance timeline</h2>
          {newest.map((e) => {
            const Icon = ICON[e.event];
            const url = explorerUrl(e.txHash);
            return (
              <div key={e.txHash + e.event} className="flex items-start gap-4">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand"><Icon size={18} aria-hidden /></div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">{TITLE[e.event]}{e.reason ? ` · ${e.reason.toLowerCase()}` : ''}</p>
                    <StatusChip kind={after.get(e) as ChipKind} />
                  </div>
                  <p className="text-xs text-mute">{fmtDateTime(e.at)} · {e.actor ?? shortAddr(e.wallet)}</p>
                  {e.notes && <p className="text-xs text-mute">{e.notes}</p>}
                  {url ? <a href={url} target="_blank" rel="noreferrer" className="font-mono text-xs text-brand hover:underline">{shortHash(e.txHash)}</a>
                    : <p className="font-mono text-xs text-brand" title={e.txHash}>{shortHash(e.txHash)}</p>}
                </div>
              </div>
            );
          })}
          <p className="text-xs text-mute">Every decision stays in the permanent audit history, including ones later resolved or reversed.</p>
        </Card>
      </div>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Scan activity for this batch</h2>
        <div className="flex flex-wrap gap-6">
          <div className="flex w-64 flex-col gap-3">
            <p className="text-[28px] font-bold leading-normal">{num(b.scans.total)} {b.scans.total === 1 ? 'scan' : 'scans'}</p>
            <p className="text-sm text-mute">Last 30 days{sectors[0] ? ` · ${sectors[0].sector}` : ''}</p>
            <p className="text-xs text-mute">{sectors.length ? `${sectors.length} ${sectors.length === 1 ? 'sector' : 'sectors'} with scans.` : 'No scans recorded in the last 30 days.'}</p>
          </div>
          <div className="flex min-w-60 flex-1 flex-col gap-4">
            {sectors.map((s) => (
              <div key={s.sector} className="flex items-center gap-3">
                <MapPin size={20} className="shrink-0 text-brand" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col"><span className="text-sm font-semibold">{s.sector}</span><span className="text-xs text-mute">Last scan {fmtDateTime(s.lastAt)}</span></div>
                <span className="text-sm font-semibold whitespace-nowrap">{num(s.scans)} {s.scans === 1 ? 'scan' : 'scans'}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {actions.node}
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-mute">{label}</span>
      <span className={`text-sm font-semibold ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

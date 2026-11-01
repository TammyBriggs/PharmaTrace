import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Printer, TriangleAlert } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useApi } from '../lib/useApi';
import { num } from '../lib/format';
import { ErrorState, Skeleton } from '../components/ui';
import { btnPrimary } from '../components/Modal';

interface Sheet {
  batch: { id: string; batchNo: string; drugName: string; gtin: string; status: string; expiryDate: string; manufacturerName: string };
  items: { serial: string; status: 'active' | 'dispensed' | 'revoked'; link: string }[];
  total: number; dispensed: number; page: number; pageSize: number;
}
const PAGE_SIZE = 48;

// Rendered outside the app shell so the printed page contains nothing but the codes.
export default function BatchPrint() {
  const { id = '' } = useParams();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Sheet>(`/serials/batch/${id}?page=${page}&pageSize=${PAGE_SIZE}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const warn = data && data.batch.status !== 'approved'
    ? data.batch.status === 'pending' ? 'This batch is not approved yet. Packs printed now will verify as Pending until a regulator approves it.'
      : `This batch is ${data.batch.status}. Packs will not verify as authentic.` : null;

  return (
    <div className="min-h-screen bg-white p-6 print:p-0">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-col gap-1">
            <Link to={`/batches/${id}`} className="flex items-center gap-1 text-xs text-brand hover:underline"><ArrowLeft size={14} aria-hidden /> Back to batch</Link>
            <h1 className="text-2xl font-bold">Pack codes{data ? ` · ${data.batch.batchNo}` : ''}</h1>
            {data && <p className="text-sm text-mute">{data.batch.drugName} · {num(data.total)} packs, {num(data.dispensed)} dispensed. Each code is unique to one pack.</p>}
          </div>
          <div className="flex items-center gap-3 text-sm text-mute">
            <span>Page {data?.page ?? page} of {num(pages)}</span>
            <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="flex size-9 items-center justify-center rounded-lg border border-line text-brand disabled:opacity-40"><ChevronLeft size={16} /></button>
            <button aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="flex size-9 items-center justify-center rounded-lg border border-line text-brand disabled:opacity-40"><ChevronRight size={16} /></button>
            <button onClick={() => window.print()} disabled={!data} className={`${btnPrimary} flex items-center gap-2`}><Printer size={16} aria-hidden /> Print this page</button>
          </div>
        </div>

        {warn && (
          <div role="alert" className="flex items-center gap-3 rounded-lg bg-[#fffbeb] p-4 text-sm text-[#b45309] print:hidden">
            <TriangleAlert size={20} className="shrink-0" aria-hidden /> {warn}
          </div>
        )}

        {error ? <ErrorState message={error} onRetry={reload} /> : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-4 print:gap-3">
            {loading && !data && Array.from({ length: 12 }, (_, i) => <li key={i}><Skeleton className="h-44 w-full" /></li>)}
            {data?.items.map((it) => (
              <li key={it.serial} className="flex break-inside-avoid flex-col items-center gap-2 rounded-lg border border-line p-3 print:border-black/30">
                <QRCodeSVG value={it.link} size={112} level="M" marginSize={1} title={`Pack ${it.serial}`} />
                <p className="font-mono text-xs font-semibold tracking-wide">{it.serial}</p>
                <p className="text-center text-[10px] leading-tight text-mute">{data.batch.batchNo} · exp {data.batch.expiryDate}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CircleCheck, Download, ExternalLink, ImageIcon, Loader2, Search, SearchX, TriangleAlert } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/useApi';
import { num } from '../lib/format';
import { fmtDateTime } from '../lib/batches';
import { reportsCsv, type ReportDetail, type ReportList, type ReportRow, type ReportState } from '../lib/reports';
import { Card, ErrorState, PageHeading, Skeleton, StatusChip } from '../components/ui';
import Modal, { btnPrimary, btnSecondary } from '../components/Modal';
import { CardList, CardSkeletons, RecordCard, cardAction } from '../components/MobileCards';

type Filter = 'all' | ReportState;
const CHIPS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All reports' }, { key: 'under_review', label: 'Under review' }, { key: 'closed', label: 'Closed' },
];

export default function FlagReports() {
  const [sp] = useSearchParams();
  const initialQ = (sp.get('q') ?? '').slice(0, 80);          // deep link, e.g. from Scan Analytics
  const [q, setQ] = useState(initialQ);
  const [search, setSearch] = useState(initialQ);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  // The photo link is created when you click, so it never arrives already expired.
  // The tab is opened first (inside the click) so the browser does not block it as a pop-up.
  async function openPhoto(id: string) {
    setPhotoErr(null); setPhotoBusy(id);
    const tab = window.open('', '_blank');
    try {
      const d = await api<ReportDetail>(`/reports/review/${id}`);
      if (!d.imageUrl) throw new Error('The photo could not be loaded. Try again in a moment.');
      if (tab) { tab.opener = null; tab.location.href = d.imageUrl; } else window.location.href = d.imageUrl;
    } catch (e) {
      tab?.close();
      setPhotoErr(e instanceof Error ? e.message : 'The photo could not be loaded.');
    } finally { setPhotoBusy(null); }
  }

  useEffect(() => {
    const t = setTimeout(() => { const v = q.trim(); if (v !== search) { setSearch(v); setPage(1); } }, 300);   // only reset the page when the search really changed
    return () => clearTimeout(t);
  }, [q, search]);

  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set('q', search);
  if (filter !== 'all') params.set('state', filter);
  const { data, error, loading, reload } = useApi<ReportList>(`/reports/review?${params}`);

  const first = loading && !data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  const m = data?.metrics;
  const filtered = !!search || filter !== 'all';

  async function exportCsv() {
    setExporting(true); setExportErr(null);
    try {
      const base = new URLSearchParams({ pageSize: '50' });
      if (search) base.set('q', search);
      if (filter !== 'all') base.set('state', filter);
      const all: ReportRow[] = [];
      for (let p = 1; ; p++) {
        base.set('page', String(p));
        const r = await api<ReportList>(`/reports/review?${base}`);
        all.push(...r.rows);
        if (all.length >= r.total || r.rows.length === 0) break;
      }
      const url = URL.createObjectURL(new Blob([reportsCsv(all)], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = `flag-reports-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setExportErr(e instanceof Error ? e.message : 'Export failed'); }
    finally { setExporting(false); }
  }

  const metrics: [string, number | undefined][] = [
    ['Open investigations', m?.open], ['Flagged batches', m?.flaggedBatches], ['Reports this month', m?.thisMonth],
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Flag Reports" subtitle="Investigate verification alerts and follow up on suspected counterfeit medicines."
        right={
          <button onClick={exportCsv} disabled={exporting || !data || data.total === 0} className={`${btnSecondary} flex items-center gap-2`}>
            {exporting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />} Export reports
          </button>} />

      {exportErr && <div role="alert" className="flex items-center gap-3 rounded-lg bg-[#fef2f2] p-4 text-sm text-danger"><TriangleAlert size={20} aria-hidden /> {exportErr}</div>}
      {banner && (
        <div role="status" className="flex items-center gap-3 rounded-lg bg-brand-tint p-4 text-sm text-brand">
          <CircleCheck size={20} className="shrink-0" aria-hidden />
          <p className="flex-1">{banner}</p>
          <button onClick={() => setBanner(null)} className="font-semibold hover:underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 sm:gap-6">
        {metrics.map(([label, n]) => (
          <div key={label} className="flex flex-col gap-2 rounded-xl border border-line bg-canvas p-3 sm:p-5">
            <p className="text-xs text-mute sm:text-sm">{label}</p>
            {n === undefined ? <Skeleton className="h-7 w-12" /> : <p className="text-2xl font-bold leading-normal sm:text-[28px]">{num(n)}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by investigation status">
          {CHIPS.map((f) => (
            <button key={f.key} aria-pressed={filter === f.key} onClick={() => { setFilter(f.key); setPage(1); }}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${filter === f.key
                ? 'border-brand bg-brand-tint text-brand' : 'border-line bg-white text-mute hover:bg-canvas'}`}>{f.label}</button>
          ))}
        </div>
        <label className="relative block w-80 max-w-full">
          <span className="sr-only">Search reports</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search batch or location"
            className="h-11 w-full rounded-lg border border-line bg-white py-3 pl-3 pr-10 text-sm outline-none placeholder:text-mute focus:border-brand focus:ring-2 focus:ring-brand/20" />
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand" aria-hidden />
        </label>
      </div>

      {photoErr && <p role="alert" className="text-sm text-danger">{photoErr}</p>}

      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <Card className="overflow-hidden !p-0">
          {first && <CardSkeletons />}
          {data && data.rows.length > 0 && (
            <CardList dim={loading}>
              {data.rows.map((r) => (
                <RecordCard key={r.id} mono title={r.batchNo} subtitle={r.drug ?? 'Unregistered batch'} badge={<StatusChip kind={r.state} />}
                  fields={[{ label: 'Reason', value: r.reason, wide: true }, { label: 'Sector', value: r.sector ?? '—' },
                    { label: 'Photo', value: r.hasImage ? (
                      <button onClick={() => openPhoto(r.id)} disabled={photoBusy === r.id} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline disabled:opacity-60">
                        {photoBusy === r.id ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <ImageIcon size={14} aria-hidden />} View photo
                      </button>) : <span className="text-mute">No photo</span> }]}
                  actions={<button onClick={() => setOpenId(r.id)} className={`${cardAction} text-brand`}>{r.state === 'closed' ? 'View report' : 'Review report'}</button>} />
              ))}
            </CardList>
          )}
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[960px] table-fixed text-sm">
              <thead>
                <tr className="h-12 bg-canvas text-left text-xs font-semibold text-mute">
                  <th className="w-[13%] px-4">Batch</th><th className="w-[20%] px-4">Drug</th><th className="w-[18%] px-4">Reason</th>
                  <th className="w-[12%] px-4">Sector</th><th className="w-[11%] px-4">Photo</th><th className="w-[14%] px-4">Investigation</th><th className="w-[12%] px-4">Action</th>
                </tr>
              </thead>
              <tbody className={loading && data ? 'opacity-60' : ''}>
                {first && (
                  <tr><td colSpan={7} className="p-0">
                    <div className="flex items-center gap-3 p-4 text-sm text-brand"><Loader2 size={20} className="animate-spin" aria-hidden /> Loading records…</div>
                  </td></tr>
                )}
                {first && Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="h-16">
                    {['w-[85%]', 'w-[90%]', 'w-[88%]', 'w-[85%]', 'w-[60%]', 'w-[82%]', 'w-[77%]'].map((w, j) => <td key={j} className="px-4"><Skeleton className={`h-3 ${w}`} /></td>)}
                  </tr>
                ))}
                {data?.rows.map((r) => (
                  <tr key={r.id} className="min-h-16 border-t border-line bg-white">
                    <td className="px-4 py-3 font-mono text-sm">{r.batchNo}</td>
                    <td className="px-4 py-3">{r.drug ?? <span className="text-mute">Unregistered batch</span>}</td>
                    <td className="px-4 py-3">{r.reason}</td>
                    <td className="px-4 py-3">{r.sector ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.hasImage ? (
                        <button onClick={() => openPhoto(r.id)} disabled={photoBusy === r.id}
                          className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-brand hover:underline disabled:opacity-60">
                          {photoBusy === r.id ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <ImageIcon size={14} aria-hidden />} View photo
                        </button>
                      ) : <span className="text-mute">No photo</span>}
                    </td>
                    <td className="px-4 py-3"><StatusChip kind={r.state} /></td>
                    <td className="px-4 py-3 text-xs">
                      <button onClick={() => setOpenId(r.id)} className="whitespace-nowrap text-left text-brand hover:underline">
                        {r.state === 'closed' ? 'View report' : 'Review report'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.rows.length === 0 && (
            <div className="flex min-h-96 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              <SearchX size={36} className="text-brand" aria-hidden />
              <h2 className="text-lg font-semibold">{filtered ? 'No flag reports found' : 'No flag reports yet'}</h2>
              <p className="max-w-md text-sm text-mute">
                {filtered ? 'No reports match these filters. Clear filters to see active investigations.'
                  : 'Reports submitted by pharmacists from the mobile app appear here for review.'}
              </p>
              {filtered && <button className={btnSecondary} onClick={() => { setQ(''); setFilter('all'); }}>Clear filters</button>}
            </div>
          )}

          <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-xs text-mute">
            <span>{first ? 'Fetching latest records' : data && data.total > 0 ? `Showing ${from}–${to} of ${num(data.total)} records` : '0 records'}</span>
            <div className="flex items-center gap-4">
              <span>Page {data?.page ?? 1} of {totalPages}</span>
              <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-brand disabled:opacity-40"><ChevronLeft size={16} /></button>
              <button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="text-brand disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          </div>
        </Card>
      )}

      <p className="text-xs text-mute">Investigation status is separate from batch verification status. Closing a report does not remove a counterfeit flag.</p>

      {openId && <ReviewModal id={openId} onClose={() => setOpenId(null)}
        onDone={(msg) => { setOpenId(null); setBanner(msg); reload(); }} />}
    </div>
  );
}

function ReviewModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: (msg: string) => void }) {
  const { data, error, loading, reload } = useApi<ReportDetail>(`/reports/review/${id}`);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(status: 'under_review' | 'closed') {
    if (!data) return;
    setBusy(true); setErr(null);
    try {
      await api(`/reports/review/${id}/status`, { method: 'POST', body: JSON.stringify({ status, note }) });
      const batchNote = data.batchStatus === 'flagged' ? 'The batch remains flagged until a separate regulator decision.'
        : 'Closing a report does not change the batch’s verification status.';
      onDone(status === 'closed' ? `Investigation for ${data.batchNo} closed. ${batchNote}`
        : `Investigation for ${data.batchNo} ${data.state === 'closed' ? 'reopened' : 'marked as under review'}.`);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not update the report.'); setBusy(false); }
  }

  const row = (k: string, v: React.ReactNode) => (
    <div className="flex gap-4 text-sm"><dt className="w-32 shrink-0 text-mute">{k}</dt><dd className="min-w-0 flex-1 break-words">{v}</dd></div>
  );

  return (
    <Modal title={data ? `Report for ${data.batchNo}` : 'Flag report'} subtitle="Review what the pharmacist reported and record the outcome." onClose={onClose} busy={busy}>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? (
        <div className="flex flex-col gap-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-24 w-full" /></div>
      ) : (
        <>
          <dl className="flex flex-col gap-3">
            {row('Investigation', <StatusChip kind={data.state} />)}
            {row('Drug', data.drug ?? <span className="text-mute">Batch number not registered</span>)}
            {data.manufacturer && row('Manufacturer', data.manufacturer)}
            {row('Reason', data.reason)}
            {row('Sector', data.sector ?? '—')}
            {row('Reported by', data.reporterName ? `${data.reporterName}${data.reporterSector ? ` · ${data.reporterSector}` : ''}` : '—')}
            {row('Reported', fmtDateTime(data.reportedAt))}
            {data.batchId && row('Batch', (
              <Link to={`/batches/${data.batchId}`} className="inline-flex items-center gap-1 text-brand hover:underline">
                View batch{data.batchStatus ? ` (${data.batchStatus})` : ''} <ExternalLink size={14} aria-hidden />
              </Link>))}
            {data.reviewedAt && row('Last reviewed', `${fmtDateTime(data.reviewedAt)}${data.reviewerName ? ` by ${data.reviewerName}` : ''}`)}
            {data.reviewNote && row('Review note', data.reviewNote)}
          </dl>

          {data.imageUrl ? (
            <div className="flex flex-col gap-2">
              <a href={data.imageUrl} target="_blank" rel="noreferrer" className="block">
                <img src={data.imageUrl} alt="Photo attached to the report" className="max-h-64 w-full rounded-lg border border-line object-contain" />
              </a>
              <a href={data.imageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                Open photo full size <ExternalLink size={14} aria-hidden />
              </a>
            </div>
          ) : data.hasImage ? (
            <p className="rounded-lg bg-canvas p-3 text-sm text-mute">A photo was attached, but it could not be loaded right now. Close this window and try again.</p>
          ) : (
            <p className="text-sm text-mute">No photo was attached to this report.</p>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="rv-note" className="text-sm font-semibold">{data.state === 'closed' ? 'Note for reopening' : 'Investigation note'}</label>
            <textarea id="rv-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3}
              placeholder={data.state === 'closed' ? 'Why is this being reopened?' : 'What did you find? Required to close the report.'}
              className="w-full resize-y rounded-lg border border-line bg-white p-3 text-sm outline-none placeholder:text-mute/70 focus:border-brand focus:ring-2 focus:ring-brand/20" />
            <p className="text-xs text-mute">Recorded in the audit log. This does not change the batch’s on-chain status.</p>
          </div>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
            <button type="button" className={btnSecondary} onClick={onClose} disabled={busy}>Cancel</button>
            {data.state === 'closed' ? (
              <button type="button" className={btnPrimary} disabled={busy || note.trim().length < 3} onClick={() => submit('under_review')}>Reopen investigation</button>
            ) : (
              <>
                {data.status === 'open' && <button type="button" className={btnSecondary} disabled={busy} onClick={() => submit('under_review')}>Mark under review</button>}
                <button type="button" className={btnPrimary} disabled={busy || note.trim().length < 3} onClick={() => submit('closed')}>Close investigation</button>
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CircleCheck, Download, Loader2, Search, SearchX, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { num } from '../lib/format';
import { shortHash } from '../lib/batches';
import { DATE_RANGES, GROUPS, actionLabel, auditCsv, fmtCat, type AuditGroup, type AuditList, type AuditRange, type AuditRow, type ChainResult } from '../lib/audit';
import { Card, ErrorState, PageHeading, Skeleton } from '../components/ui';
import { btnSecondary } from '../components/Modal';
import RangeMenu from '../components/RangeMenu';

export default function AuditLog() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<AuditGroup>('all');
  const [range, setRange] = useState<AuditRange>('all');
  const [page, setPage] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { const v = q.trim(); if (v !== search) { setSearch(v); setPage(1); } }, 300);
    return () => clearTimeout(t);
  }, [q, search]);

  const qs = (p: number, size?: number) => {
    const u = new URLSearchParams({ page: String(p) });
    if (size) u.set('pageSize', String(size));
    if (search) u.set('q', search);
    if (group !== 'all') u.set('group', group);
    if (range !== 'all') u.set('range', range);
    return u.toString();
  };
  const { data, error, loading, reload } = useApi<AuditList>(`/audit?${qs(page)}`);

  const first = loading && !data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  const filtered = !!search || group !== 'all' || range !== 'all';
  const rangeLabel = DATE_RANGES.find((r) => r.key === range)!.label;

  async function exportCsv() {
    setExporting(true); setExportErr(null);
    try {
      const all: AuditRow[] = [];
      for (let p = 1; ; p++) {
        const r = await api<AuditList>(`/audit?${qs(p, 100)}`);
        all.push(...r.rows);
        if (all.length >= r.total || r.rows.length === 0) break;
      }
      const url = URL.createObjectURL(new Blob([auditCsv(all)], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      setBanner(`Audit log exported successfully. ${num(all.length)} action${all.length === 1 ? '' : 's'} included in the export.`);
    } catch (e) { setExportErr(e instanceof Error ? e.message : 'Export failed'); }
    finally { setExporting(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Audit Log" subtitle="A chronological, read-only record of regulator decisions and confirmed transactions."
        right={
          <button onClick={exportCsv} disabled={exporting || !data || data.total === 0} className={`${btnSecondary} flex items-center gap-2`}>
            {exporting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />} Export audit log
          </button>} />

      {exportErr && <div role="alert" className="flex items-center gap-3 rounded-lg bg-[#fef2f2] p-4 text-sm text-danger"><TriangleAlert size={20} aria-hidden /> {exportErr}</div>}
      {banner && (
        <div role="status" className="flex items-center gap-3 rounded-lg bg-brand-tint p-4 text-sm text-brand">
          <CircleCheck size={20} className="shrink-0" aria-hidden />
          <p className="flex-1">{banner}</p>
          <button onClick={() => setBanner(null)} className="font-semibold hover:underline">Dismiss</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="relative block w-80 max-w-full">
          <span className="sr-only">Search the audit log</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, batch or transaction"
            className="h-11 w-full rounded-lg border border-line bg-white py-3 pl-3 pr-10 text-sm outline-none placeholder:text-mute focus:border-brand focus:ring-2 focus:ring-brand/20" />
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand" aria-hidden />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by action">
          {GROUPS.map((f) => (
            <button key={f.key} aria-pressed={group === f.key} onClick={() => { setGroup(f.key); setPage(1); }}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${group === f.key
                ? 'border-brand bg-brand-tint text-brand' : 'border-line bg-white text-mute hover:bg-canvas'}`}>{f.label}</button>
          ))}
        </div>
        <RangeMenu value={range} onChange={(r) => { setRange(r); setPage(1); }} label={rangeLabel} options={DATE_RANGES} />
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <Card className="overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-sm">
              <thead>
                <tr className="h-12 bg-canvas text-left text-xs font-semibold text-mute">
                  <th className="w-[19%] px-4">Actor</th><th className="w-[22%] px-4">Action</th><th className="w-[21%] px-4">Batch / manufacturer</th>
                  <th className="w-[17%] px-4">Tx hash</th><th className="w-[21%] px-4">Timestamp (CAT)</th>
                </tr>
              </thead>
              <tbody className={loading && data ? 'opacity-60' : ''}>
                {first && (
                  <tr><td colSpan={5} className="p-0">
                    <div className="flex items-center gap-3 p-4 text-sm text-brand"><Loader2 size={20} className="animate-spin" aria-hidden /> Loading records…</div>
                  </td></tr>
                )}
                {first && Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="h-16">
                    {['w-[80%]', 'w-[85%]', 'w-[85%]', 'w-[80%]', 'w-[85%]'].map((w, j) => <td key={j} className="px-4"><Skeleton className={`h-3 ${w}`} /></td>)}
                  </tr>
                ))}
                {data?.rows.map((r) => (
                  <tr key={r.seq} className="min-h-16 border-t border-line bg-white">
                    <td className="px-4 py-3">{r.actor}</td>
                    <td className="px-4 py-3">{actionLabel(r.action)}</td>
                    <td className="px-4 py-3 font-mono text-sm break-words"><Subject r={r} /></td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {r.txHash ? <span title={r.txHash}>{shortHash(r.txHash)}</span> : <span className="text-mute" title="Recorded off-chain">—</span>}
                    </td>
                    <td className="px-4 py-3">{fmtCat(r.tsMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.rows.length === 0 && (
            <div className="flex min-h-96 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              <SearchX size={36} className="text-brand" aria-hidden />
              <h2 className="text-lg font-semibold">No regulator actions found</h2>
              <p className="max-w-md text-sm text-mute">
                {filtered ? 'No audit entries match this batch and date range.' : 'Approvals, flags and other regulator decisions are recorded here as they happen.'}
              </p>
              {filtered && <button className={btnSecondary} onClick={() => { setQ(''); setGroup('all'); setRange('all'); }}>Clear filters</button>}
            </div>
          )}

          <div className="flex h-16 items-center justify-between border-t border-line px-4 text-xs text-mute">
            <span>{first ? 'Fetching latest records' : data && data.total > 0 ? `Showing ${from}–${to} of ${num(data.total)} records` : '0 records'}</span>
            <div className="flex items-center gap-4">
              <span>Page {data?.page ?? 1} of {totalPages}</span>
              <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-brand disabled:opacity-40"><ChevronLeft size={16} /></button>
              <button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="text-brand disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          </div>
        </Card>
      )}

      <IntegrityNote />
    </div>
  );
}

function Subject({ r }: { r: AuditRow }) {
  if (!r.subject) return <span className="text-mute">—</span>;
  if (r.entityType === 'batch' && r.entityId) return <Link to={`/batches/${r.entityId}`} className="hover:text-brand hover:underline">{r.subject}</Link>;
  if (r.entityType === 'report') return <Link to={`/flag-reports?q=${encodeURIComponent(r.subject)}`} className="hover:text-brand hover:underline">{r.subject}</Link>;
  return <>{r.subject}</>;
}

function IntegrityNote() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ChainResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function verify() {
    setBusy(true); setErr(null);
    try { setRes(await api<ChainResult>('/audit/verify')); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not verify the chain'); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-canvas p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
          <p className="font-semibold">Every decision has a traceable record</p>
          <p className="text-mute">Only confirmed regulator actions appear here. Manufacturer submissions are shown in the batch provenance timeline.</p>
        </div>
        <button type="button" onClick={verify} disabled={busy} className={`${btnSecondary} flex items-center gap-2`}>
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />} Verify integrity
        </button>
      </div>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      {res && (res.ok ? (
        <div role="status" className="flex items-start gap-3 rounded-lg bg-brand-tint p-4 text-sm text-brand">
          <ShieldCheck size={20} className="shrink-0" aria-hidden />
          <p>Chain intact. All {num(res.checked)} entries were re-checked, including submissions and pack dispenses, and none has been altered or removed. Latest entry fingerprint <span className="font-mono">{shortHash(res.head)}</span>.</p>
        </div>
      ) : (
        <div role="alert" className="flex items-start gap-3 rounded-lg bg-[#fef2f2] p-4 text-sm text-danger">
          <ShieldAlert size={20} className="shrink-0" aria-hidden />
          <p><b>Integrity check failed at entry #{res.brokenAtSeq}.</b> {res.reason} Entries before it ({num(res.checked)}) still verify. Treat the log after this point as untrusted and investigate.</p>
        </div>
      ))}
    </div>
  );
}

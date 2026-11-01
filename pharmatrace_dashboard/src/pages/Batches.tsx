import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, ChevronLeft, ChevronRight, Clock3, Loader2, Plus, Search, SearchX, TriangleAlert } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../auth/AuthContext';
import { explain, useWallet, type WalletErrorCode } from '../lib/wallet';
import { addMonths, chipFor, shortHash, type BatchContext, type BatchDetail, type BatchList, type BStatus, type Product } from '../lib/batches';
import { fmtDay, num } from '../lib/format';
import { Card, ErrorState, PageHeading, Skeleton, StatusChip } from '../components/ui';
import Modal, { btnPrimary, btnSecondary } from '../components/Modal';
import { useBatchActions } from '../components/BatchActions';

type Filter = 'all' | BStatus;

const field = 'h-11 w-full rounded-lg border border-line bg-white p-3 text-sm outline-none placeholder:text-mute/70 focus:border-brand focus:ring-2 focus:ring-brand/20';
const today = () => new Date().toISOString().slice(0, 10);

export default function Batches() {
  const { user } = useAuth();
  const isReg = user?.role === 'regulator' || user?.role === 'super_admin';
  const isMfr = user?.role === 'manufacturer' || user?.role === 'super_admin';

  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => { setSearch(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set('search', search);
  if (filter !== 'all') params.set('status', filter);
  const { data, error, loading, reload } = useApi<BatchList>(`/batches?${params}`);
  const ctx = useApi<BatchContext>('/batches/context');

  const onDone = useCallback((d: { kind: string; batch: BatchDetail; txHash: string }) => {
    const what: Record<string, string> = { approve: 'approved', flag: 'flagged', resolve: 'flag resolved', revoke: 'revoked', reinstate: 'reinstated' };
    setBanner(`${d.batch.batchNo} ${what[d.kind]} successfully. Transaction confirmed: ${shortHash(d.txHash)}.`);
    reload();
  }, [reload]);
  const actions = useBatchActions(ctx.data?.reasons ?? [], onDone);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  const noneAtAll = !!data && data.counts.total === 0;
  const first = loading && !data;
  const c = data?.counts;

  const chips: { key: Filter; label: string; n: number | undefined }[] = [
    { key: 'all', label: 'All', n: c?.total }, { key: 'pending', label: 'Pending', n: c?.pending },
    { key: 'approved', label: 'Approved', n: c?.approved }, { key: 'flagged', label: 'Flagged', n: c?.flagged },
    ...(c && c.revoked > 0 ? [{ key: 'revoked' as Filter, label: 'Revoked', n: c.revoked }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Batches"
        subtitle={isReg ? 'Review submissions, approve verified medicines and investigate counterfeit risks.'
          : 'Submit batches for regulator approval and track their status.'}
        right={isMfr ? (
          <button onClick={() => setSubmitOpen(true)} disabled={!ctx.data?.canSubmit} className={`${btnPrimary} flex h-11 items-center gap-2`}
            title={ctx.data && !ctx.data.canSubmit ? ctx.data.reason ?? undefined : undefined}>
            <Plus size={16} aria-hidden /> Submit batch
          </button>) : undefined} />

      {banner ? (
        <div role="status" className="flex items-center gap-3 rounded-lg bg-brand-tint p-4 text-sm text-brand">
          <CircleCheck size={20} className="shrink-0" aria-hidden />
          <p className="flex-1">{banner}</p>
          <button onClick={() => setBanner(null)} className="font-semibold hover:underline">Dismiss</button>
        </div>
      ) : data && c && c.pending > 0 ? (
        <div className="flex items-center gap-3 rounded-lg bg-[#fffbeb] p-4 text-sm text-[#b45309]">
          <CircleAlert size={20} className="shrink-0" aria-hidden />
          {isReg
            ? `${num(c.pending)} pending ${c.pending === 1 ? 'batch needs' : 'batches need'} review. Teal-highlighted rows require a regulator action.`
            : `${num(c.pending)} ${c.pending === 1 ? 'batch is' : 'batches are'} awaiting regulator approval.`}
        </div>
      ) : null}

      {isMfr && ctx.data && !ctx.data.canSubmit && user?.role === 'manufacturer' && (
        <div role="alert" className="flex items-center gap-3 rounded-lg bg-[#fffbeb] p-4 text-sm text-[#b45309]">
          <TriangleAlert size={20} className="shrink-0" aria-hidden /> {ctx.data.reason ?? 'You cannot submit batches right now.'}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {chips.map((f) => (
            <button key={f.key} aria-pressed={filter === f.key} onClick={() => { setFilter(f.key); setPage(1); }}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${filter === f.key
                ? 'border-brand bg-brand-tint text-brand' : 'border-line bg-white text-mute hover:bg-canvas'}`}>
              {f.label}{f.n !== undefined ? ` · ${num(f.n)}` : ''}
            </button>
          ))}
        </div>
        <label className="relative block w-72 max-w-full">
          <span className="sr-only">Search batches</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search batch or drug"
            className="h-11 w-full rounded-lg border border-line bg-white py-3 pl-3 pr-10 text-sm outline-none placeholder:text-mute focus:border-brand focus:ring-2 focus:ring-brand/20" />
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand" aria-hidden />
        </label>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <Card className="overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed text-sm">
              <thead>
                <tr className="h-12 bg-canvas text-left text-xs font-semibold text-mute">
                  <th className="w-[16%] px-4">Batch no.</th><th className="w-[25%] px-4">Drug</th><th className="w-[19%] px-4">Manufacturer</th>
                  <th className="w-[12%] px-4">Expiry</th><th className="w-[13%] px-4">Status</th><th className="w-[15%] px-4">Actions</th>
                </tr>
              </thead>
              <tbody className={loading && data ? 'opacity-60' : ''}>
                {first && (
                  <tr><td colSpan={6} className="p-0">
                    <div className="flex items-center gap-3 p-4 text-sm text-brand"><Loader2 size={20} className="animate-spin" aria-hidden /> Loading records…</div>
                  </td></tr>
                )}
                {first && Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="h-16">
                    {['w-[85%]', 'w-[90%]', 'w-[88%]', 'w-[80%]', 'w-[80%]', 'w-[84%]'].map((w, j) => <td key={j} className="px-4"><Skeleton className={`h-3 ${w}`} /></td>)}
                  </tr>
                ))}
                {data?.items.map((b) => (
                  <tr key={b.id} className={`min-h-16 border-t border-line ${b.status === 'pending' && isReg ? 'bg-brand-tint' : 'bg-white'}`}>
                    <td className="px-4 py-3 font-mono text-sm"><Link to={`/batches/${b.id}`} className="hover:text-brand hover:underline">{b.batchNo}</Link></td>
                    <td className="px-4 py-3">{b.drugName}</td>
                    <td className="px-4 py-3">{b.manufacturerName}</td>
                    <td className="px-4 py-3">{fmtDay(b.expiryDate)}</td>
                    <td className="px-4 py-3"><StatusChip kind={chipFor(b)} /></td>
                    <td className="px-4 py-3 text-xs font-semibold text-brand">
                      {b.status === 'pending' && isReg ? (
                        <div className="flex gap-2">
                          <button onClick={() => actions.start(b, 'approve')} className="hover:underline">Approve</button>
                          <button onClick={() => actions.start(b, 'flag')} className="hover:underline">Flag</button>
                        </div>
                      ) : <Link to={`/batches/${b.id}`} className="font-normal hover:underline">{b.status === 'flagged' ? 'View report' : 'View details'}</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.items.length === 0 && (
            <div className="flex min-h-96 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              {noneAtAll ? <Clock3 size={36} className="text-brand" aria-hidden /> : <SearchX size={36} className="text-brand" aria-hidden />}
              <h2 className="text-lg font-semibold">{noneAtAll ? 'No batches submitted yet' : 'No batches match these filters'}</h2>
              <p className="max-w-md text-sm text-mute">
                {noneAtAll
                  ? (isMfr ? 'Submit your first batch to start the approval workflow.' : 'Batches appear here once a manufacturer submits them.')
                  : search ? `No batch ${search} is registered. Try another batch number.` : 'No batches have this status. Try another filter.'}
              </p>
              {noneAtAll
                ? (isMfr && ctx.data?.canSubmit && <button className={btnPrimary} onClick={() => setSubmitOpen(true)}>Submit batch</button>)
                : <button className={btnSecondary} onClick={() => { setQ(''); setFilter('all'); }}>Clear filters</button>}
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

      <p className="text-xs text-mute">Expiry dates are displayed in local time. Approval and flagging actions are recorded in the audit log.</p>

      {submitOpen && ctx.data?.manufacturer && (
        <SubmitModal ctx={ctx.data} onClose={() => setSubmitOpen(false)} onSubmitted={reload} />
      )}
      {actions.node}
    </div>
  );
}

// ───────────────────────── Submit batch ─────────────────────────
interface Run { stage: 'prepare' | 'wallet' | 'chain' | 'record' | 'error'; id?: string; hash?: string; error?: string; code?: WalletErrorCode }
const STEPS: [Run['stage'], string][] = [['prepare', 'Preparing the batch'], ['wallet', 'Waiting for MetaMask'], ['chain', 'Confirming on the blockchain'], ['record', 'Generating serial numbers and recording']];

function SubmitModal({ ctx, onClose, onSubmitted }: { ctx: BatchContext; onClose: () => void; onSubmitted: () => void }) {
  const { ensureReady } = useWallet();
  const [pq, setPq] = useState('');
  const [products, setProducts] = useState<Product[] | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [f, setF] = useState({ batchNo: '', mfgDate: '', quantity: '' });
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [created, setCreated] = useState<BatchDetail | null>(null);

  const maker = ctx.manufacturer!.name;
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      const p = new URLSearchParams({ manufacturer: maker, limit: '6' });
      if (pq.trim()) p.set('q', pq.trim());
      api<{ items: Product[] }>(`/products?${p}`).then((r) => live && setProducts(r.items)).catch(() => live && setProducts([]));
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [pq, maker]);

  const expiry = product && /^\d{4}-\d{2}-\d{2}$/.test(f.mfgDate) ? addMonths(f.mfgDate, product.shelfLifeMonths) : null;

  const confirm = useCallback(async (id: string, hash: string) => {
    setRun({ stage: 'record', id, hash });
    try {
      const r = await api<{ batch: BatchDetail }>(`/batches/${id}/confirm-submit`, { method: 'POST', body: JSON.stringify({ txHash: hash }) });
      setRun(null); setCreated(r.batch); onSubmitted();
    } catch (e) {
      setRun({ stage: 'error', id, hash, error: `The transaction succeeded on-chain, but saving it failed: ${(e as Error).message} You can retry; the on-chain action will not be repeated.` });
    }
  }, [onSubmitted]);

  async function go() {
    if (!product) return;
    setRun({ stage: 'prepare' });
    let id: string | undefined, hash: string | undefined;
    try {
      const prep = await api<{ id: string; chain: { batchNo: string; metadataHash: string; mfgDate: number; expiryDate: number } }>('/batches', {
        method: 'POST', body: JSON.stringify({ productId: product.id, batchNo: f.batchNo, mfgDate: f.mfgDate, quantity: Number(f.quantity) }),
      });
      id = prep.id;
      setRun({ stage: 'wallet', id });
      const contract = await ensureReady();
      const sent = await contract.submitBatch(prep.chain.batchNo, prep.chain.metadataHash, prep.chain.mfgDate, prep.chain.expiryDate);
      hash = sent.hash as string;
      setRun({ stage: 'chain', id, hash });
      await sent.wait();
      await confirm(id, hash);
    } catch (e) {
      const w = explain(e);
      setRun({ stage: 'error', id, hash, error: e instanceof Error && !('code' in e) ? e.message : w.message, code: w.code });
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = Number(f.quantity);
    if (!product) return setError('Choose a product from the catalogue.');
    if (!/^[A-Z0-9][A-Z0-9\-/]{2,39}$/.test(f.batchNo)) return setError('Batch number must be 3–40 characters: letters, digits, "-" or "/".');
    if (!f.mfgDate) return setError('Enter the manufacture date.');
    if (f.mfgDate > today()) return setError('The manufacture date cannot be in the future.');
    if (expiry && expiry <= today()) return setError('This batch would already be expired. Check the manufacture date.');
    if (!Number.isInteger(qty) || qty < 1 || qty > ctx.maxQuantity) return setError(`Quantity must be a whole number from 1 to ${num(ctx.maxQuantity)}.`);
    void go();
  }

  if (created) {
    return (
      <Modal title="Batch submitted" subtitle={`${created.batchNo} is waiting for regulator approval.`} onClose={onClose}>
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-canvas p-5">
          <div className="flex items-center gap-3"><CircleCheck size={40} className="shrink-0 text-brand" aria-hidden />
            <div className="flex flex-col gap-1"><b>Submission recorded on-chain</b><StatusChip kind="pending" /></div></div>
          <div className="text-sm"><b>{created.drugName}</b><div className="text-mute">{num(created.quantity)} packs · expires {fmtDay(created.expiryDate)}</div></div>
          <div className="font-mono text-xs text-brand" title={created.submitTxHash}>{shortHash(created.submitTxHash)}</div>
          <p className="text-xs text-mute">{num(created.serials.total)} unique serial numbers were generated for this batch.</p>
        </div>
        <div className="flex justify-end gap-3">
          <button className={btnSecondary} onClick={onClose}>Close</button>
          <Link to={`/batches/${created.id}`} className={`${btnPrimary} flex items-center`}>View batch</Link>
        </div>
      </Modal>
    );
  }

  if (run) {
    const failed = run.stage === 'error';
    const idx = STEPS.findIndex(([s]) => s === run.stage);
    return (
      <Modal title={failed ? (run.code === 'SETUP' ? 'Blockchain not ready' : 'Submission not completed') : 'Submitting batch'} subtitle={f.batchNo} onClose={() => setRun(null)} busy={!failed}>
        {failed ? (
          <>
            <div role="alert" className="flex items-start gap-3 rounded-lg bg-[#fef2f2] p-4 text-sm text-[#b91c1c]"><TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden /> {run.error}</div>
            <div className="flex justify-end gap-3">
              <button className={btnSecondary} onClick={() => setRun(null)}>Back to form</button>
              <button className={btnPrimary} onClick={() => (run.hash && run.id ? void confirm(run.id, run.hash) : void go())}>{run.hash ? 'Retry saving' : 'Try again'}</button>
            </div>
          </>
        ) : (
          <ol className="flex flex-col gap-3 text-sm">
            {STEPS.map(([s, label], i) => (
              <li key={s} className={`flex items-center gap-3 ${i > idx ? 'text-mute' : ''}`}>
                {i < idx ? <CircleCheck size={18} className="text-brand" aria-hidden /> : i === idx ? <Loader2 size={18} className="animate-spin text-brand" aria-hidden /> : <Clock3 size={18} aria-hidden />}
                {label}{i === idx && s === 'wallet' ? ' — approve the request in the MetaMask window' : ''}
              </li>
            ))}
          </ol>
        )}
      </Modal>
    );
  }

  return (
    <Modal title="Submit batch" subtitle={`Register a new production batch for ${maker}. A regulator reviews it before it can verify as authentic.`} onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="sb-q" className="text-sm font-semibold">Product</label>
          {product ? (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-brand bg-brand-tint p-3 text-sm">
              <div><b>{product.brandName}</b> · {product.genericName} {product.strength}
                <div className="text-xs text-mute">{product.dosageForm} · {product.packSize} · shelf life {product.shelfLifeMonths} months</div>
                <div className="mt-1 text-xs text-mute">GTIN <span className="font-mono text-ink">{product.gtin}</span></div></div>
              <button type="button" onClick={() => setProduct(null)} className="text-xs font-semibold text-brand hover:underline">Change</button>
            </div>
          ) : (
            <>
              <input id="sb-q" className={field} value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Search your catalogue by brand, generic name or registration no." />
              <ul className="flex max-h-48 flex-col overflow-y-auto rounded-lg border border-line">
                {products === null && <li className="p-3 text-sm text-mute">Loading products…</li>}
                {products?.length === 0 && <li className="p-3 text-sm text-mute">No catalogue products match for {maker}.</li>}
                {products?.map((p) => (
                  <li key={p.id}><button type="button" onClick={() => setProduct(p)} className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-canvas">
                    <span className="font-semibold">{p.brandName} <span className="font-normal text-mute">· {p.genericName} {p.strength}</span></span>
                    <span className="text-xs text-mute">{p.dosageForm} · {p.packSize}</span></button></li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="sb-no" className="text-sm font-semibold">Batch number</label>
          <input id="sb-no" className={`${field} font-mono`} value={f.batchNo} onChange={(e) => setF((s) => ({ ...s, batchNo: e.target.value.toUpperCase() }))} placeholder="e.g. RW-2026-0417" spellCheck={false} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="sb-mfg" className="text-sm font-semibold">Manufacture date</label>
            <input id="sb-mfg" type="date" max={today()} className={field} value={f.mfgDate} onChange={(e) => setF((s) => ({ ...s, mfgDate: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="sb-qty" className="text-sm font-semibold">Quantity (packs)</label>
            <input id="sb-qty" type="number" min={1} max={ctx.maxQuantity} className={field} value={f.quantity} onChange={(e) => setF((s) => ({ ...s, quantity: e.target.value }))} placeholder={`Up to ${num(ctx.maxQuantity)}`} />
          </div>
        </div>
        {expiry && <p className="text-sm text-mute">Expiry date: <b className="text-ink">{fmtDay(expiry)}</b> (manufacture date + {product!.shelfLifeMonths} months). One unique serial is generated per pack.</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" className={btnPrimary}>Continue to wallet</button>
        </div>
      </form>
    </Modal>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { id as keccak } from 'ethers';
import { CircleCheck, ChevronDown, ChevronLeft, ChevronRight, Clock3, Info, Loader2, Plus, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { explain, shortAddr, useWallet } from '../lib/wallet';
import { fmtDay, num } from '../lib/format';
import { Card, ErrorState, PageHeading, Skeleton, StatusChip, type ChipKind } from '../components/ui';
import Modal, { btnDanger, btnPrimary, btnSecondary } from '../components/Modal';

type MStatus = 'pending' | 'active' | 'revoked';
interface Mf { id: string; name: string; licenseNumber: string; wallet: string; country: string; status: MStatus; approvedDate: string | null }
interface ListResp {
  items: Mf[]; total: number; page: number; pageSize: number;
  counts: { total: number; approved: number; pending: number; revoked: number };
}
type Filter = 'all' | 'approved' | 'pending' | 'revoked';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All statuses' }, { key: 'approved', label: 'Approved' },
  { key: 'pending', label: 'Pending' }, { key: 'revoked', label: 'Revoked' },
];
const CHIP: Record<MStatus, ChipKind> = { active: 'approved', pending: 'pending', revoked: 'revoked' };

// Keep in sync with COUNTRIES in manufacturerController.js
const COUNTRIES = ['Rwanda', 'Kenya', 'Uganda', 'Tanzania', 'Burundi', 'DR Congo', 'Ethiopia',
  'South Africa', 'Egypt', 'India', 'China', 'Other'];

const field = 'h-11 w-full rounded-lg border border-line bg-white p-3 text-sm outline-none placeholder:text-mute/70 focus:border-brand focus:ring-2 focus:ring-brand/20';

type TxKind = 'approve' | 'revoke';
interface TxState { m: Mf; kind: TxKind; stage: 'wallet' | 'chain' | 'record' | 'error'; error?: string; hash?: string }

export default function Manufacturers() {
  const { ensureReady } = useWallet();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [revoking, setRevoking] = useState<Mf | null>(null);
  const [tx, setTx] = useState<TxState | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => { setSearch(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set('search', search);
  if (filter !== 'all') params.set('status', filter);
  const { data, error, loading, reload } = useApi<ListResp>(`/manufacturers?${params}`);

  const record = useCallback(async (m: Mf, kind: TxKind, hash: string) => {
    setTx({ m, kind, stage: 'record', hash });
    try {
      await api(`/manufacturers/${m.id}/confirm`, { method: 'POST', body: JSON.stringify({ txHash: hash }) });
      setTx(null);
      setToast(kind === 'approve' ? `${m.name} is now approved on-chain.` : `${m.name} has been revoked.`);
      reload();
    } catch (e) {
      setTx({ m, kind, stage: 'error', hash,
        error: `The transaction succeeded on-chain, but saving it failed: ${(e as Error).message} You can retry; the on-chain action will not be repeated.` });
    }
  }, [reload]);

  async function runTx(m: Mf, kind: TxKind) {
    setTx({ m, kind, stage: 'wallet' });
    try {
      const contract = await ensureReady();
      const sent = kind === 'approve'
        ? await contract.registerManufacturer(m.wallet, keccak(m.licenseNumber))
        : await contract.revokeManufacturer(m.wallet);
      setTx({ m, kind, stage: 'chain', hash: sent.hash });
      await sent.wait();
      await record(m, kind, sent.hash);
    } catch (e) {
      setTx({ m, kind, stage: 'error', error: explain(e).message });
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  const noneAtAll = !!data && data.counts.total === 0;
  const first = loading && !data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Manufacturers"
        subtitle={`Manage licensed suppliers and their registered wallet addresses.${data ? ` ${num(data.counts.total)} registered manufacturers.` : ''}`}
        right={
          <button onClick={() => setRegisterOpen(true)} className={`${btnPrimary} flex h-11 items-center gap-2`}>
            <Plus size={16} aria-hidden /> Register manufacturer
          </button>
        } />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="relative block w-92 max-w-full">
          <span className="sr-only">Search manufacturers</span>
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, licence or wallet"
            className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-sm outline-none placeholder:text-mute focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </label>
        <div className="flex gap-2" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f.key} aria-pressed={filter === f.key} onClick={() => { setFilter(f.key); setPage(1); }}
              className={`h-11 rounded-lg border px-4 text-sm font-semibold ${filter === f.key
                ? 'border-brand bg-brand-tint text-brand' : 'border-line bg-white text-mute hover:bg-canvas'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <Card className="overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed text-sm">
              <thead>
                <tr className="h-11 bg-canvas text-left text-xs font-semibold text-mute">
                  <th className="w-[26%] px-4">Manufacturer</th><th className="w-[16%] px-4">Licence number</th>
                  <th className="w-[17%] px-4">Wallet address</th><th className="w-[14%] px-4">Status</th>
                  <th className="w-[15%] px-4">Approved date</th><th className="w-[12%] px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className={loading && data ? 'opacity-60' : ''}>
                {first && Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="h-16 border-t border-line">
                    {Array.from({ length: 6 }, (_, j) => <td key={j} className="px-4"><Skeleton className="h-4 w-4/5" /></td>)}
                  </tr>
                ))}
                {data?.items.map((m) => (
                  <tr key={m.id} className={`h-16 border-t border-line ${m.status === 'pending' ? 'bg-brand-tint/50' : ''}`}>
                    <td className="px-4"><div className="truncate font-semibold">{m.name}</div><div className="text-xs text-mute">{m.country}</div></td>
                    <td className="px-4 font-mono text-xs">{m.licenseNumber}</td>
                    <td className="px-4 font-mono text-xs text-brand" title={m.wallet}>{shortAddr(m.wallet)}</td>
                    <td className="px-4"><StatusChip kind={CHIP[m.status]} /></td>
                    <td className="px-4 text-mute">
                      {m.status === 'active' && m.approvedDate ? fmtDay(m.approvedDate) : m.status === 'pending' ? 'Awaiting approval' : 'Revoked'}
                    </td>
                    <td className="px-4 text-right">
                      {m.status === 'active'
                        ? <button onClick={() => setRevoking(m)} className="text-sm font-semibold text-danger hover:underline">Revoke</button>
                        : <button onClick={() => runTx(m, 'approve')} className="text-sm font-semibold text-brand hover:underline">
                            {m.status === 'revoked' ? 'Reinstate' : 'Approve'}
                          </button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.items.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <Search size={28} className="text-brand" aria-hidden />
              <h2 className="text-lg font-semibold">{noneAtAll ? 'No manufacturers registered yet' : 'No manufacturers match your search'}</h2>
              <p className="max-w-96 text-sm text-mute">
                {noneAtAll ? 'Register the first licensed supplier to start approving batches.' : 'Try a different name, licence number or wallet, or clear the filters.'}
              </p>
              {noneAtAll
                ? <button onClick={() => setRegisterOpen(true)} className={btnPrimary}>Register manufacturer</button>
                : <button onClick={() => { setQ(''); setFilter('all'); }} className={btnSecondary}>Clear filters</button>}
            </div>
          )}

          {data && data.total > 0 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-mute">
              <span>Showing {from}–{to} of {num(data.total)} records</span>
              <div className="flex items-center gap-3">
                <span>Page {data.page} of {totalPages}</span>
                <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="flex size-8 items-center justify-center rounded-lg border border-line text-brand disabled:opacity-40"><ChevronLeft size={16} /></button>
                <button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                  className="flex size-8 items-center justify-center rounded-lg border border-line text-brand disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 text-sm">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <p className="text-mute">
          <b className="text-ink">Pending registrations must be reviewed before batch approvals.</b>{' '}
          Approving a manufacturer is signed in MetaMask and recorded on-chain.
        </p>
      </div>

      {registerOpen && <RegisterModal total={data?.counts.total ?? 0} onClose={() => setRegisterOpen(false)} onCreated={reload}
        onView={(licence) => { setRegisterOpen(false); setFilter('all'); setQ(licence); }} />}

      {revoking && (
        <Modal title={`Revoke ${revoking.name}?`} subtitle="This is recorded on-chain and signed in MetaMask." onClose={() => setRevoking(null)}>
          <div className="flex items-start gap-3 rounded-lg bg-[#fef2f2] p-4 text-sm text-[#b91c1c]">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
            Every batch from this manufacturer will immediately show as Revoked when scanned. It can be reinstated later.
          </div>
          <div className="flex justify-end gap-3">
            <button className={btnSecondary} onClick={() => setRevoking(null)}>Cancel</button>
            <button className={btnDanger} onClick={() => { const m = revoking; setRevoking(null); runTx(m, 'revoke'); }}>Revoke manufacturer</button>
          </div>
        </Modal>
      )}

      {tx && <TxDialog tx={tx} onClose={() => setTx(null)} onRetry={() => (tx.hash ? record(tx.m, tx.kind, tx.hash) : runTx(tx.m, tx.kind))} />}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-card">
          <CircleCheck size={16} aria-hidden /> {toast}
        </div>
      )}
    </div>
  );
}

function TxDialog({ tx, onClose, onRetry }: { tx: TxState; onClose: () => void; onRetry: () => void }) {
  const verb = tx.kind === 'approve' ? 'Approving' : 'Revoking';
  const steps: [TxState['stage'], string][] = [['wallet', 'Waiting for MetaMask'], ['chain', 'Confirming on the blockchain'], ['record', 'Recording in the audit log']];
  const failed = tx.stage === 'error';
  const idx = steps.findIndex(([s]) => s === tx.stage);
  return (
    <Modal title={failed ? 'Transaction not completed' : `${verb} ${tx.m.name}`} onClose={onClose} busy={!failed}>
      {failed ? (
        <>
          <div role="alert" className="flex items-start gap-3 rounded-lg bg-[#fef2f2] p-4 text-sm text-[#b91c1c]">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden /> {tx.error}
          </div>
          <div className="flex justify-end gap-3">
            <button className={btnSecondary} onClick={onClose}>Close</button>
            <button className={btnPrimary} onClick={onRetry}>{tx.hash ? 'Retry saving' : 'Try again'}</button>
          </div>
        </>
      ) : (
        <ol className="flex flex-col gap-3 text-sm">
          {steps.map(([s, label], i) => (
            <li key={s} className={`flex items-center gap-3 ${i > idx ? 'text-mute' : ''}`}>
              {i < idx ? <CircleCheck size={18} className="text-brand" aria-hidden />
                : i === idx ? <Loader2 size={18} className="animate-spin text-brand" aria-hidden />
                : <Clock3 size={18} aria-hidden />}
              {label}{i === idx && s === 'wallet' ? ' — approve the request in the MetaMask window' : ''}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

function RegisterModal({ total, onClose, onCreated, onView }: {
  total: number; onClose: () => void; onCreated: () => void; onView: (licence: string) => void;
}) {
  const [f, setF] = useState({ name: '', licenseNumber: '', wallet: '', country: 'Rwanda' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Mf | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (f.name.trim().length < 2) return setError('Enter the manufacturer name.');
    if (f.licenseNumber.trim().length < 3) return setError('Enter the licence number.');
    if (!/^0x[0-9a-fA-F]{40}$/.test(f.wallet.trim())) return setError('Enter a valid wallet address (0x followed by 40 characters).');
    setBusy(true);
    try {
      const r = await api<{ manufacturer: Mf }>('/manufacturers', { method: 'POST', body: JSON.stringify(f) });
      setCreated(r.manufacturer);
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  }

  if (created) {
    return (
      <Modal title="Manufacturer registered" subtitle={`${created.name} has been added to the register.`} onClose={onClose}>
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-canvas p-5">
          <div className="flex items-center gap-3">
            <CircleCheck size={40} className="shrink-0 text-brand" aria-hidden />
            <div className="flex flex-col gap-1"><b>Registration successful</b><StatusChip kind="pending" /></div>
          </div>
          <div className="text-sm"><b>{created.name}</b><div className="text-mute">{created.licenseNumber} · {created.country}</div></div>
          <div className="font-mono text-xs text-brand" title={created.wallet}>{shortAddr(created.wallet)}</div>
          <p className="text-xs text-mute">{num(total)} registered manufacturers · Licence approval is pending.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-mute">
          <CircleCheck size={16} className="text-brand" aria-hidden /> The manufacturer can submit batches after licence review.
        </div>
        <div className="flex justify-end gap-3">
          <button className={btnSecondary} onClick={onClose}>Close</button>
          <button className={btnPrimary} onClick={() => onView(created.licenseNumber)}>View manufacturer</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Register manufacturer" subtitle="Add a licensed supplier. Details are saved as pending until the licence is reviewed." onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="mf-name" className="text-sm font-semibold">Manufacturer name</label>
          <input id="mf-name" className={field} value={f.name} onChange={set('name')} placeholder="e.g. Medilab Africa Ltd" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="mf-lic" className="text-sm font-semibold">Licence number</label>
          <input id="mf-lic" className={`${field} font-mono`} value={f.licenseNumber} onChange={set('licenseNumber')} placeholder="e.g. FDA-MFG-0084" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="mf-wallet" className="text-sm font-semibold">Wallet address</label>
          <input id="mf-wallet" className={`${field} font-mono`} value={f.wallet} onChange={set('wallet')} placeholder="0x…" spellCheck={false} />
          <p className="flex items-center gap-1.5 text-xs text-mute"><Info size={14} aria-hidden /> The address this manufacturer will sign batch submissions with.</p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="mf-country" className="text-sm font-semibold">Country</label>
          <div className="relative">
            <select id="mf-country" className={`${field} appearance-none pr-10`} value={f.country} onChange={set('country')}>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className={btnSecondary} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Register manufacturer'}</button>
        </div>
      </form>
    </Modal>
  );
}

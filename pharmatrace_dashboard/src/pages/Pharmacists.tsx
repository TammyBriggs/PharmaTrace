import { useEffect, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, CircleCheck, KeyRound, Plus, Search, TriangleAlert, UserRoundX, UserRoundCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { fmtDateTime, num } from '../lib/format';
import { GASABO_SECTORS } from '../lib/sectors';
import { Card, ErrorState, PageHeading, Skeleton } from '../components/ui';
import Modal, { btnDanger, btnPrimary, btnSecondary } from '../components/Modal';
import Credentials from '../components/Credentials';
import { CardList, CardSkeletons, RecordCard, cardAction } from '../components/MobileCards';

interface Ph { id: string; name: string; contact: string; sector: string | null; active: boolean; mustChangePassword: boolean; lastLogin: string | null }
interface ListResp {
  items: Ph[]; total: number; page: number; pageSize: number;
  counts: { total: number; active: number; inactive: number; awaiting: number };
}
interface Issued { user: Ph; temporaryPassword: string; emailSent: boolean }
type Filter = 'all' | 'active' | 'inactive';
const FILTERS: { key: Filter; label: string }[] = [{ key: 'all', label: 'All accounts' }, { key: 'active', label: 'Active' }, { key: 'inactive', label: 'Deactivated' }];

const field = 'h-11 w-full rounded-lg border border-line bg-white p-3 text-sm outline-none placeholder:text-mute/70 focus:border-brand focus:ring-2 focus:ring-brand/20';

function StatusPill({ p }: { p: Ph }) {
  const [cls, label] = !p.active ? ['bg-[#f3f4f6] text-mute', 'Deactivated']
    : p.mustChangePassword ? ['bg-[#fffbeb] text-[#b45309]', 'Awaiting first sign-in']
    : ['bg-[#f0fdfa] text-[#0f766e]', 'Active'];
  return <span className={`inline-flex w-fit items-center rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap ${cls}`}>{label}</span>;
}

export default function Pharmacists() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [issued, setIssued] = useState<{ title: string; data: Issued } | null>(null);
  const [resetting, setResetting] = useState<Ph | null>(null);
  const [toggling, setToggling] = useState<Ph | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => { setSearch(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set('search', search);
  if (filter !== 'all') params.set('status', filter);
  const { data, error, loading, reload } = useApi<ListResp>(`/users?${params}`);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  const first = loading && !data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Pharmacists"
        subtitle={`Create and manage pharmacist accounts for the mobile app.${data ? ` ${num(data.counts.active)} active, ${num(data.counts.awaiting)} awaiting first sign-in.` : ''}`}
        right={<button onClick={() => setAdding(true)} className={`${btnPrimary} flex h-11 items-center gap-2`}><Plus size={16} aria-hidden /> Add pharmacist</button>} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="relative block w-92 max-w-full">
          <span className="sr-only">Search pharmacists</span>
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or sector"
            className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-sm outline-none placeholder:text-mute focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f.key} aria-pressed={filter === f.key} onClick={() => { setFilter(f.key); setPage(1); }}
              className={`h-11 rounded-lg border px-4 text-sm font-semibold ${filter === f.key ? 'border-brand bg-brand-tint text-brand' : 'border-line bg-white text-mute hover:bg-canvas'}`}>{f.label}</button>
          ))}
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <Card className="overflow-hidden !p-0">
          {first && <CardSkeletons />}
          {data && data.items.length > 0 && (
            <CardList dim={loading}>
              {data.items.map((p) => (
                <RecordCard key={p.id} title={p.name} subtitle={p.contact} badge={<StatusPill p={p} />}
                  fields={[{ label: 'Sector', value: p.sector ?? <span className="text-mute">Not set</span> }, { label: 'Last sign-in', value: p.lastLogin ? fmtDateTime(p.lastLogin) : 'Never' }]}
                  actions={<>
                    <button onClick={() => setResetting(p)} className={`${cardAction} text-brand`}><KeyRound size={14} aria-hidden /> Reset password</button>
                    <button onClick={() => setToggling(p)} className={`${cardAction} ${p.active ? 'text-danger' : 'text-brand'}`}>
                      {p.active ? <><UserRoundX size={14} aria-hidden /> Deactivate</> : <><UserRoundCheck size={14} aria-hidden /> Reactivate</>}
                    </button>
                  </>} />
              ))}
            </CardList>
          )}
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[900px] table-fixed text-sm">
              <thead>
                <tr className="h-11 bg-canvas text-left text-xs font-semibold text-mute">
                  <th className="w-[24%] px-4">Pharmacist</th><th className="w-[14%] px-4">Sector</th><th className="w-[18%] px-4">Status</th>
                  <th className="w-[18%] px-4">Last sign-in</th><th className="w-[26%] px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={loading && data ? 'opacity-60' : ''}>
                {first && Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="h-16 border-t border-line">{Array.from({ length: 5 }, (_, j) => <td key={j} className="px-4"><Skeleton className="h-4 w-4/5" /></td>)}</tr>
                ))}
                {data?.items.map((p) => (
                  <tr key={p.id} className="h-16 border-t border-line">
                    <td className="px-4"><div className="truncate font-semibold">{p.name}</div><div className="truncate text-xs text-mute">{p.contact}</div></td>
                    <td className="px-4">{p.sector ?? <span className="text-mute">Not set</span>}</td>
                    <td className="px-4"><StatusPill p={p} /></td>
                    <td className="px-4 text-mute">{p.lastLogin ? fmtDateTime(p.lastLogin) : 'Never'}</td>
                    <td className="px-4">
                      <div className="flex items-center justify-end gap-4">
                        <button onClick={() => setResetting(p)} className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline"><KeyRound size={14} aria-hidden /> Reset password</button>
                        <button onClick={() => setToggling(p)}
                          className={`flex items-center gap-1 text-sm font-semibold hover:underline ${p.active ? 'text-danger' : 'text-brand'}`}>
                          {p.active ? <><UserRoundX size={14} aria-hidden /> Deactivate</> : <><UserRoundCheck size={14} aria-hidden /> Reactivate</>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.items.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <Search size={28} className="text-brand" aria-hidden />
              <h2 className="text-lg font-semibold">{data.counts.total === 0 ? 'No pharmacist accounts yet' : 'No pharmacists match your search'}</h2>
              <p className="max-w-96 text-sm text-mute">{data.counts.total === 0 ? 'Add the first pharmacist. They sign in to the mobile app with the temporary password you give them.' : 'Try a different name, email or sector, or clear the filters.'}</p>
              {data.counts.total === 0
                ? <button onClick={() => setAdding(true)} className={btnPrimary}>Add pharmacist</button>
                : <button onClick={() => { setQ(''); setFilter('all'); }} className={btnSecondary}>Clear filters</button>}
            </div>
          )}

          {data && data.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-sm text-mute">
              <span>Showing {from}–{to} of {num(data.total)} accounts</span>
              <div className="flex items-center gap-3">
                <span>Page {data.page} of {totalPages}</span>
                <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="flex size-8 items-center justify-center rounded-lg border border-line text-brand disabled:opacity-40"><ChevronLeft size={16} /></button>
                <button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="flex size-8 items-center justify-center rounded-lg border border-line text-brand disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </Card>
      )}

      {adding && <AddModal onClose={() => setAdding(false)} onCreated={(d) => { setAdding(false); setIssued({ title: 'Pharmacist account created', data: d }); reload(); }} />}

      {resetting && (
        <Modal title={`Reset password for ${resetting.name}?`} subtitle="A new temporary password replaces the current one." onClose={() => setResetting(null)}>
          <div className="flex items-start gap-3 rounded-lg bg-[#fffbeb] p-4 text-sm text-[#b45309]">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden /> Their current password stops working at once, and they must choose a new one when they next sign in.
          </div>
          <ResetActions pharmacist={resetting} onCancel={() => setResetting(null)} onDone={(d) => { setResetting(null); setIssued({ title: 'New temporary password', data: d }); reload(); }} />
        </Modal>
      )}

      {toggling && (
        <Modal title={toggling.active ? `Deactivate ${toggling.name}?` : `Reactivate ${toggling.name}?`}
          subtitle={toggling.active ? 'They will no longer be able to sign in. Their scan history stays.' : 'They will be able to sign in again with their current password.'} onClose={() => setToggling(null)}>
          <ToggleActions pharmacist={toggling} onCancel={() => setToggling(null)}
            onDone={(msg) => { setToggling(null); setToast(msg); reload(); }} />
        </Modal>
      )}

      {issued && (
        <Modal title={issued.title} subtitle={`${issued.data.user.name} · ${issued.data.user.sector ?? 'no sector'}`} onClose={() => setIssued(null)}>
          <Credentials contact={issued.data.user.contact} password={issued.data.temporaryPassword} emailSent={issued.data.emailSent} />
          <div className="flex justify-end [&>button]:w-full sm:[&>button]:w-auto"><button className={btnPrimary} onClick={() => setIssued(null)}>Done</button></div>
        </Modal>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-card">
          <CircleCheck size={16} aria-hidden /> {toast}
        </div>
      )}
    </div>
  );
}

function ResetActions({ pharmacist, onCancel, onDone }: { pharmacist: Ph; onCancel: () => void; onDone: (d: Issued) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true); setError(null);
    try { onDone(await api<Issued>(`/users/${pharmacist.id}/reset-password`, { method: 'POST', body: '{}' })); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return (
    <>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
        <button className={btnSecondary} onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={btnPrimary} onClick={go} disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</button>
      </div>
    </>
  );
}

function ToggleActions({ pharmacist, onCancel, onDone }: { pharmacist: Ph; onCancel: () => void; onDone: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true); setError(null);
    try {
      await api(`/users/${pharmacist.id}/active`, { method: 'PATCH', body: JSON.stringify({ active: !pharmacist.active }) });
      onDone(pharmacist.active ? `${pharmacist.name} has been deactivated.` : `${pharmacist.name} can sign in again.`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return (
    <>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
        <button className={btnSecondary} onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={pharmacist.active ? btnDanger : btnPrimary} onClick={go} disabled={busy}>{busy ? 'Saving…' : pharmacist.active ? 'Deactivate' : 'Reactivate'}</button>
      </div>
    </>
  );
}

function AddModal({ onClose, onCreated }: { onClose: () => void; onCreated: (d: Issued) => void }) {
  const [f, setF] = useState({ name: '', contact: '', sector: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (f.name.trim().length < 2) return setError('Enter the pharmacist’s name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.contact.trim()) && !/^\+?[0-9 ]{9,15}$/.test(f.contact.trim())) return setError('Enter a valid email address or phone number.');
    if (!f.sector) return setError('Choose the pharmacy’s sector.');
    setBusy(true);
    try { onCreated(await api<Issued>('/users', { method: 'POST', body: JSON.stringify({ ...f, name: f.name.trim(), contact: f.contact.trim() }) })); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <Modal title="Add pharmacist" subtitle="They sign in to the mobile app with a temporary password and choose their own at first sign-in." onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="ph-name" className="text-sm font-semibold">Full name</label>
          <input id="ph-name" className={field} value={f.name} onChange={set('name')} placeholder="e.g. Aline Uwase" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="ph-contact" className="text-sm font-semibold">Email address (or phone number)</label>
          <input id="ph-contact" className={field} value={f.contact} onChange={set('contact')} placeholder="name@pharmacy.rw" autoComplete="off" />
          <p className="text-xs text-mute">This is what they sign in with. An email lets us send the temporary password and a reset code.</p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="ph-sector" className="text-sm font-semibold">Sector of the pharmacy</label>
          <div className="relative">
            <select id="ph-sector" className={`${field} appearance-none pr-10`} value={f.sector} onChange={set('sector')}>
              <option value="">Choose a sector…</option>
              {GASABO_SECTORS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
          <button type="button" className={btnSecondary} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        </div>
      </form>
    </Modal>
  );
}

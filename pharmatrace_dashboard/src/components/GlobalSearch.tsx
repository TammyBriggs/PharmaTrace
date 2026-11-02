import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Hash, Loader2, Pill, Search, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';

interface Result { type: 'batch' | 'manufacturer' | 'transaction'; id: string; title: string; subtitle: string; target: { type: 'batch' | 'manufacturer'; id: string } }

const TAG: Record<Result['type'], { label: string; Icon: LucideIcon }> = {
  batch: { label: 'Batch', Icon: Pill },
  manufacturer: { label: 'Manufacturer', Icon: Building2 },
  transaction: { label: 'Transaction', Icon: Hash },
};

/** Typeahead in the header. Suggestions float over the page; the page itself is never filtered. */
export default function GlobalSearch({ canSearchManufacturers }: { canSearchManufacturers: boolean }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const term = q.trim();
  const ready = term.length >= 2;

  useEffect(() => {
    if (!ready) { setResults([]); setBusy(false); setFailed(false); return; }
    let live = true;
    setBusy(true);
    const t = setTimeout(() => {
      api<{ results: Result[] }>(`/search?q=${encodeURIComponent(term)}`)
        .then((r) => { if (live) { setResults(r.results); setActive(0); setFailed(false); } })
        .catch(() => live && setFailed(true))
        .finally(() => live && setBusy(false));
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [term, ready]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const go = (r: Result) => {
    setOpen(false); setQ('');
    nav(r.target.type === 'manufacturer' ? `/manufacturers/${r.target.id}` : `/batches/${r.target.id}`);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return setOpen(false);
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % results.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
    if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
  };

  const showPanel = open && ready;
  return (
    <div ref={box} className="relative w-100 max-w-full">
      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        role="combobox" aria-expanded={showPanel} aria-controls="global-search-list" aria-label="Search" autoComplete="off"
        placeholder={canSearchManufacturers ? 'Search batch, manufacturer or transaction' : 'Search your batches or transactions'}
        className="h-10 w-full rounded-lg border border-line bg-canvas pl-10 pr-9 text-sm outline-none placeholder:text-mute focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20" />
      {busy && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-mute" aria-hidden />}

      {showPanel && (
        <div className="absolute left-0 right-0 top-12 z-30 overflow-hidden rounded-xl border border-line bg-white shadow-card">
          {results.length > 0 ? (
            <ul id="global-search-list" role="listbox">
              {results.map((r, i) => {
                const { label, Icon } = TAG[r.type];
                return (
                  <li key={`${r.type}:${r.id}`} role="option" aria-selected={i === active}
                    onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); go(r); }}
                    className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${i === active ? 'bg-brand-tint' : ''}`}>
                    <Icon size={16} className="shrink-0 text-brand" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-sm font-semibold ${r.type === 'transaction' ? 'font-mono text-xs' : ''}`}>{r.title}</div>
                      <div className="truncate text-xs text-mute">{r.subtitle}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-mute">{label}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-mute">
              {failed ? 'Search is unavailable right now.' : busy ? 'Searching…' : `No matches for “${term}”.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

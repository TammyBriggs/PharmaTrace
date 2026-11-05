import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Info, MapPinned, ShieldAlert } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { num } from '../lib/format';
import { Card, ErrorState, PageHeading, Skeleton } from '../components/ui';

interface DrugCount { drug: string; scans: number }
interface ConcernDrug { drug: string; verdict: 'flagged' | 'expired' | 'revoked'; scans: number }
interface SectorRow {
  sector: string; lat: number; lng: number; total: number;
  authentic: number; flagged: number; expired: number; revoked: number; duplicate: number; pending: number; notFound: number;
  concern: number; status: 'none' | 'ok' | 'concern'; topDrugs: DrugCount[]; concernDrugs: ConcernDrug[];
}
interface MapResp {
  range: string; label: string; sectors: SectorRow[];
  totals: { scans: number; concern: number; sectorsWithConcern: number; withoutLocation: number };
}
type Range = 'today' | '7d' | '30d' | 'all';
const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' }, { key: '7d', label: '7 days' }, { key: '30d', label: '30 days' }, { key: 'all', label: 'All time' },
];

// Green = only authentic scans. Red = at least one flagged, expired or revoked scan. Grey = no scans in this period.
const GREEN = '#059669';
const RED = '#dc2626';
const GREY = '#9ca3af';
const colour = (s: SectorRow) => (s.status === 'concern' ? RED : s.status === 'ok' ? GREEN : GREY);

const VERDICT_WORD: Record<ConcernDrug['verdict'], string> = { flagged: 'flagged', expired: 'expired', revoked: 'revoked' };

export default function RiskMap() {
  const [range, setRange] = useState<Range>('30d');
  const { data, error, loading, reload } = useApi<MapResp>(`/overview/map?range=${range}`);
  const [selected, setSelected] = useState<string | null>(null);

  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  // Create the map once.
  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomControl: true, scrollWheelZoom: false }).setView([-1.9, 30.11], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 15, minZoom: 9,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; layer.current = null; fitted.current = false; };
  }, []);

  // Draw one circle per sector. Names go in as text, never as HTML.
  useEffect(() => {
    const g = layer.current;
    if (!g || !data) return;
    g.clearLayers();
    for (const s of data.sectors) {
      const radius = s.total === 0 ? 7 : Math.min(30, 9 + Math.sqrt(s.total) * 1.6);
      const c = L.circleMarker([s.lat, s.lng], {
        radius, color: colour(s), fillColor: colour(s), fillOpacity: s.total === 0 ? 0.25 : 0.55,
        weight: selected === s.sector ? 4 : 2,
      });
      const tip = document.createElement('span');
      tip.textContent = s.total === 0 ? `${s.sector}: no scans` : `${s.sector}: ${num(s.total)} scans${s.concern ? `, ${num(s.concern)} flagged` : ''}`;
      c.bindTooltip(tip, { direction: 'top' });
      c.on('click', () => setSelected(s.sector));
      c.addTo(g);
    }
    if (!fitted.current && map.current) {
      map.current.fitBounds(L.latLngBounds(data.sectors.map((s) => [s.lat, s.lng] as [number, number])), { padding: [40, 40] });
      fitted.current = true;
    }
  }, [data, selected]);

  const ranked = useMemo(() => (data ? [...data.sectors].sort((a, b) => b.concern - a.concern || b.total - a.total) : []), [data]);
  const current = data?.sectors.find((s) => s.sector === selected) ?? null;
  const first = loading && !data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Risk map"
        subtitle="Where scanned medicines came back authentic or flagged, by sector in Gasabo District."
        right={
          <div className="flex gap-2" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button key={r.key} aria-pressed={range === r.key} onClick={() => setRange(r.key)}
                className={`h-10 rounded-lg border px-4 text-sm font-semibold ${range === r.key ? 'border-brand bg-brand-tint text-brand' : 'border-line bg-white text-mute hover:bg-canvas'}`}>{r.label}</button>
            ))}
          </div>
        } />

      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ['Scans on the map', data ? num(data.totals.scans) : null, 'by pharmacists, placed by sector'],
              ['Sectors with alerts', data ? num(data.totals.sectorsWithConcern) : null, 'at least one flagged, expired or revoked scan'],
              ['Flagged-type scans', data ? num(data.totals.concern) : null, 'flagged, expired or revoked'],
              ['Scans without a location', data ? num(data.totals.withoutLocation) : null, 'anonymous patient scans, not mapped'],
            ].map(([label, value, note]) => (
              <Card key={label as string} className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-mute">{label}</span>
                {first ? <Skeleton className="h-8 w-16" /> : <span className="text-2xl font-bold">{value}</span>}
                <span className="text-xs text-mute">{note}</span>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="flex flex-col gap-3 !p-3">
              <div ref={box} className="h-[520px] w-full overflow-hidden rounded-lg" role="application" aria-label="Map of Gasabo sectors" />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-2 pb-1 text-xs text-mute">
                {[[GREEN, 'Authentic scans only'], [RED, 'Flagged, expired or revoked scans'], [GREY, 'No scans']].map(([c, l]) => (
                  <span key={l} className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: c }} aria-hidden /> {l}</span>
                ))}
                <span>Circle size = number of scans</span>
              </div>
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="flex flex-col gap-4">
                {current ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">{current.sector}</h2>
                        <p className="text-xs text-mute">{data?.label} · {num(current.total)} scans</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${current.status === 'concern' ? 'bg-[#fef2f2] text-[#b91c1c]' : current.status === 'ok' ? 'bg-[#f0fdfa] text-[#0f766e]' : 'bg-[#f3f4f6] text-mute'}`}>
                        {current.status === 'concern' ? 'Alerts' : current.status === 'ok' ? 'Authentic only' : 'No scans'}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {([['Authentic', current.authentic, GREEN], ['Flagged', current.flagged, RED], ['Expired', current.expired, RED], ['Revoked', current.revoked, RED]] as const).map(([l, n, c]) => (
                        <div key={l} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2">
                          <dt className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: c }} aria-hidden />{l}</dt>
                          <dd className="font-semibold">{num(n)}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-xs text-mute">Also in this period: {num(current.duplicate)} already-dispensed, {num(current.pending)} pending, {num(current.notFound)} not found.</p>
                    {current.concernDrugs.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert size={16} className="text-danger" aria-hidden /> Behind the alerts</h3>
                        <ul className="flex flex-col gap-1 text-sm">
                          {current.concernDrugs.map((d) => (
                            <li key={`${d.drug}-${d.verdict}`} className="flex justify-between gap-3"><span className="min-w-0 truncate">{d.drug}</span><span className="shrink-0 text-mute">{num(d.scans)} {VERDICT_WORD[d.verdict]}</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {current.topDrugs.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold">Most scanned</h3>
                        <ul className="flex flex-col gap-1 text-sm">
                          {current.topDrugs.map((d) => <li key={d.drug} className="flex justify-between gap-3"><span className="min-w-0 truncate">{d.drug}</span><span className="shrink-0 text-mute">{num(d.scans)}</span></li>)}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-start gap-2">
                    <MapPinned size={24} className="text-brand" aria-hidden />
                    <h2 className="text-lg font-semibold">Select a sector</h2>
                    <p className="text-sm text-mute">Click a circle on the map, or a sector below, to see its scans by status and the products behind any alerts.</p>
                  </div>
                )}
              </Card>

              <Card className="!p-0">
                <h2 className="px-5 pt-4 text-sm font-semibold">Sectors by alerts</h2>
                <ul className="mt-2 max-h-72 overflow-y-auto pb-2">
                  {first && Array.from({ length: 6 }, (_, i) => <li key={i} className="px-5 py-2"><Skeleton className="h-4 w-full" /></li>)}
                  {ranked.map((s) => (
                    <li key={s.sector}>
                      <button onClick={() => setSelected(s.sector)} aria-pressed={selected === s.sector}
                        className={`flex w-full items-center justify-between gap-3 px-5 py-2 text-left text-sm hover:bg-canvas ${selected === s.sector ? 'bg-brand-tint' : ''}`}>
                        <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: colour(s) }} aria-hidden />{s.sector}</span>
                        <span className="text-xs text-mute">{s.total === 0 ? 'no scans' : `${num(s.concern)} of ${num(s.total)} flagged`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 text-sm">
            <Info size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden />
            <p className="text-mute">
              <b className="text-ink">Privacy by design.</b> Circles sit at the middle of a sector, not where a scan happened. No scan stores GPS or an address.
              Only scans by signed-in pharmacists are placed on the map, using their pharmacy’s sector. Patient scans are anonymous and are counted, not mapped.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

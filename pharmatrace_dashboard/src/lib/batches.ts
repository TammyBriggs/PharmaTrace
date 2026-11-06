import { id as keccak } from 'ethers';
import type { ChipKind } from '../components/ui';

export type BStatus = 'pending' | 'approved' | 'flagged' | 'revoked';

export interface BatchRow {
  id: string; batchNo: string; drugName: string; brandName: string | null; strength: string | null; dosageForm: string | null;
  category: string; quantity: number; status: BStatus; manufacturerName: string; expiryDate: string; expired: boolean;
}
export interface Totals { pending: number; approved: number; flagged: number; revoked: number }
export interface BatchList {
  items: BatchRow[]; total: number; page: number; pageSize: number; counts: Totals & { total: number };
}
export type EventKind = 'submitted' | 'approved' | 'flagged' | 'flag_resolved' | 'revoked' | 'reinstated';
export interface BatchEvent {
  event: EventKind; txHash: string; reason: string | null; notes: string | null; wallet: string; actor: string | null; at: string;
}
export interface BatchDetail {
  id: string; batchNo: string; status: BStatus; gtin: string; drugName: string; category: string;
  brandName: string | null; genericName: string | null; strength: string | null; dosageForm: string | null; packSize: string | null;
  registrationNumber: string | null; quantity: number; mfgDate: string; expiryDate: string; expired: boolean;
  manufacturer: { id: string; name: string; licenseNumber: string; wallet: string };
  batchIdHash: string; submitTxHash: string; serialRoot: string | null; serialCount: number | null;
  flag: { reason: string; notes: string; txHash: string } | null;
  revoke: { reason: string; notes: string; txHash: string } | null;
  link: string; events: BatchEvent[];
  serials: { total: number; active: number; dispensed: number; revoked: number };
  scans: { total: number; bySector: { sector: string; scans: number; lastAt: string }[] };
}
export interface BatchContext {
  canSubmit: boolean; reason: string | null; manufacturer: { id: string; name: string; wallet: string } | null;
  reasons: string[]; maxQuantity: number;
}
export interface Product {
  id: string; registrationNumber: string; brandName: string; genericName: string; strength: string; dosageForm: string;
  packSize: string; shelfLifeMonths: number; category: string; manufacturerName: string; country: string; gtin: string;
}

/** Must stay identical to reasonHashOf() in batchController.js: the server recomputes it from the text. */
export const reasonHashOf = (reason: string, notes: string) => keccak(`${reason.trim()}\n${notes.trim()}`);

export const chipFor = (b: { status: BStatus; expired?: boolean }): ChipKind =>
  b.status === 'approved' && b.expired ? 'expired' : b.status;

export const drugLabel = (b: { drugName: string }) => b.drugName;

export const shortHash = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

/** "2026-10-02T09:42:00Z" -> "02 Oct 2026, 09:42" in the viewer's local time. */
export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())} ${M[d.getMonth()]} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Same month-end clamping as addMonths() on the server, used only for the expiry preview. */
export function addMonths(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}

export const explorerUrl = (hash: string) => {
  const base = import.meta.env.VITE_EXPLORER_URL as string | undefined;
  return base ? `${base.replace(/\/$/, '')}/tx/${hash}` : null;
};

export type AuditGroup = 'all' | 'approvals' | 'flags';
export type AuditRange = 'all' | 'today' | '7d' | '30d';
export interface AuditRow {
  seq: string; tsMs: string; actor: string; action: string; entityType: string; entityId: string | null;
  subject: string | null; txHash: string | null; rowHash: string;
}
export interface AuditList { total: number; page: number; pageSize: number; rows: AuditRow[] }
export type ChainResult =
  | { ok: true; checked: number; total: number; head: string; verifiedAt: string }
  | { ok: false; checked: number; total: number; brokenAtSeq: string; reason: string; verifiedAt: string };

export const GROUPS: { key: AuditGroup; label: string }[] = [
  { key: 'all', label: 'All actions' }, { key: 'approvals', label: 'Approvals' }, { key: 'flags', label: 'Flags' },
];
export const DATE_RANGES: { key: AuditRange; label: string }[] = [
  { key: 'all', label: 'All dates' }, { key: 'today', label: 'Today' }, { key: '7d', label: 'Last 7 days' }, { key: '30d', label: 'Last 30 days' },
];

const LABEL: Record<string, string> = {
  'batch.approve': 'Approved batch', 'batch.flag': 'Flagged batch', 'batch.flag_resolve': 'Resolved flag',
  'batch.revoke': 'Revoked batch', 'batch.reinstate': 'Reinstated batch',
  'manufacturer.register': 'Registered manufacturer', 'manufacturer.revoke': 'Revoked manufacturer',
  'account.create': 'Created account', 'account.reset': 'Reset password',
  'account.activate': 'Reactivated account', 'account.deactivate': 'Deactivated account',
  'report.review': 'Reviewed flag report', 'report.close': 'Closed flag report', 'report.reopen': 'Reopened flag report',
};
export const actionLabel = (a: string) => LABEL[a] ?? a;

/** "02 Oct 2026, 10:24" in Kigali time, whatever the viewer's own time zone is. */
export function fmtCat(tsMs: string | number) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kigali', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(Number(tsMs))).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function auditCsv(rows: AuditRow[]) {
  const head = ['Entry', 'Time (CAT)', 'Actor', 'Action', 'Batch / manufacturer', 'Tx hash', 'Row hash'];
  const lines = rows.map((r) => [r.seq, fmtCat(r.tsMs), r.actor, actionLabel(r.action), r.subject, r.txHash, r.rowHash].map(cell).join(','));
  return [head.map(cell).join(','), ...lines].join('\r\n');
}

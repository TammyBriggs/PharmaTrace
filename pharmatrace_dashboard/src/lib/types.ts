export type VerdictKey = 'authentic' | 'flagged' | 'expired' | 'pending' | 'revoked' | 'not_found';
export type AlertKind = 'flagged' | 'expired' | 'pending' | 'revoked' | 'duplicate';

export interface OverviewData {
  generatedAt: string;
  kpis: {
    manufacturers: { active: number; thisMonth: number };
    batches: { approved: number; pending: number; flagged: number };
    openInvestigations: number;
    scansToday: { total: number; sectors: number; unknown: number };
  };
  scansOverTime: { total: number; points: { date: string; count: number }[] };
  verdicts: Record<VerdictKey, number> & { total: number };
  categories: { category: string; count: number }[];
  alerts: { kind: AlertKind; batchNo: string | null; drug: string | null; detail: string; time: string; at: string }[];
}

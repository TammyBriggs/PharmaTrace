export type RangeKey = 'today' | '7d' | '30d';
export interface SuspiciousCard {
  batchId: string; batchNo: string; drug: string; batchStatus: string;
  risk: 'high' | 'under_review' | 'review'; title: string; detail: string; link: 'report' | 'batch';
}
export interface AnalyticsData {
  range: RangeKey; dateLabel: string; generatedAt: string; burstMin: number;
  totals: { total: number; sectors: number; unknown: number; suspiciousBatches: number };
  sectors: { sector: string | null; count: number }[];
  suspicious: SuspiciousCard[];
}
export const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' }, { key: '7d', label: 'Last 7 days' }, { key: '30d', label: 'Last 30 days' },
];

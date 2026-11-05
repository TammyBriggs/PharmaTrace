export type ReportState = 'under_review' | 'closed';
export interface ReportRow {
  id: string; batchNo: string; drug: string | null; reason: string; sector: string | null;
  status: string; state: ReportState; reportedAt: string; hasImage: boolean;
}
export interface ReportList {
  metrics: { open: number; flaggedBatches: number; thisMonth: number };
  total: number; page: number; pageSize: number; rows: ReportRow[];
}
export interface ReportDetail {
  id: string; batchNo: string; reason: string; sector: string | null; status: string; state: ReportState;
  reportedAt: string; reviewedAt: string | null; reviewNote: string | null;
  reporterName: string | null; reporterSector: string | null; reviewerName: string | null;
  batchId: string | null; drug: string | null; batchStatus: string | null; manufacturer: string | null;
  imageUrl: string | null; hasImage: boolean;
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function reportsCsv(rows: ReportRow[]) {
  const head = ['Batch', 'Drug', 'Reason', 'Sector', 'Photo attached', 'Investigation', 'Reported at'];
  const lines = rows.map((r) => [r.batchNo, r.drug, r.reason, r.sector, r.hasImage ? 'Yes' : 'No', r.state === 'closed' ? 'Closed' : 'Under review', r.reportedAt].map(csvCell).join(','));
  return [head.map(csvCell).join(','), ...lines].join('\r\n');
}

import type { BStatus } from './batches';

export interface MfStats { submitted: number; approved: number; pending: number; flagged: number; revoked: number; drugs: number; packs: number }
export interface RecentBatch { id: string; batchNo: string; drug: string; status: BStatus; quantity: number; expiryDate: string }

export interface MfProfile {
  id: string; name: string; licenseNumber: string; wallet: string; country: string;
  status: 'pending' | 'active' | 'revoked';
  registerTxHash: string | null; revokeTxHash: string | null;
  createdAt: string; approvedAt: string | null; revokedAt: string | null; contact: string | null;
  stats: MfStats; recentBatches: RecentBatch[];
}

export interface MyOverview {
  manufacturer: { name: string; licenseNumber: string; status: 'pending' | 'active' | 'revoked'; country: string };
  stats: MfStats;
  scans: { today: number; week: number; sectors: number; points: { date: string; count: number }[] };
  verdicts: Record<string, number> & { total: number };
  attention: {
    flagged: { id: string; batchNo: string; drug: string; status: 'flagged' | 'revoked'; reason: string | null }[];
    expiring: { id: string; batchNo: string; drug: string; expiryDate: string; days: number }[];
  };
  activity: { event: string; reason: string | null; at: string; batchNo: string; drug: string; batchId: string }[];
}

export const EVENT_LABEL: Record<string, string> = {
  submitted: 'submitted for review', approved: 'approved', flagged: 'flagged', flag_resolved: 'flag cleared',
  revoked: 'revoked', reinstated: 'reinstated',
};

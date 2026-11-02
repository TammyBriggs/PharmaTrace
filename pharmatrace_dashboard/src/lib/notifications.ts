export interface NotificationItem {
  id: string; kind: string; title: string; body: string; at: string; isNew: boolean;
}
export interface NotificationsResp { unread: number; generatedAt: string; items: NotificationItem[] }

/** "2026-11-02T11:30:00Z" -> "just now" / "5 min ago" / "3 h ago" / "02 Nov" */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

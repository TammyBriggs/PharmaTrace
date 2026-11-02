import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { api } from '../lib/api';
import { ago, type NotificationItem, type NotificationsResp } from '../lib/notifications';

const POLL_MS = 60_000;

/** Bell with an unread dot, and a panel that slides over the right edge of the page (the page is not resized). */
export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationsResp | null>(null);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState<NotificationItem[]>([]);   // snapshot while open, so "New" labels stay visible
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try { setData(await api<NotificationsResp>('/notifications')); setFailed(false); }
    catch { setFailed(true); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (open) return;                                   // no refresh under the user's eyes
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [open, load]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [open]);

  const toggle = () => {
    if (open) return setOpen(false);
    setShown(data?.items ?? []);
    setOpen(true);
    if (data && data.unread > 0) {
      setData({ ...data, unread: 0 });                  // clear the dot at once; refresh only after the server has recorded it
      api('/notifications/seen', { method: 'POST', body: JSON.stringify({ seenAt: data.generatedAt }) })
        .catch(() => undefined).finally(load);
    } else load();
  };

  const dot = !!data && data.unread > 0 && !open;

  return (
    <>
      <button onClick={toggle} aria-label={dot ? `Notifications, ${data!.unread} new` : 'Notifications'}
        aria-expanded={open} className="relative text-brand">
        <Bell size={20} />
        {dot && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-danger" aria-hidden />}
      </button>

      <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
        <div onClick={() => setOpen(false)} aria-hidden
          className={`absolute inset-0 bg-ink/20 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} />
        <aside role="dialog" aria-label="Notifications" aria-hidden={!open}
          className={`absolute right-0 top-0 flex h-full w-96 max-w-full flex-col border-l border-line bg-white shadow-card transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex h-22 shrink-0 items-center justify-between border-b border-line px-6">
            <h2 className="text-lg font-semibold">Notifications</h2>
            <button ref={closeRef} onClick={() => setOpen(false)} aria-label="Close notifications" tabIndex={open ? 0 : -1}
              className="flex size-9 items-center justify-center rounded-lg text-mute hover:bg-canvas"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {failed && shown.length === 0 && <p className="p-6 text-sm text-mute">Could not load notifications. They will refresh automatically.</p>}
            {!failed && shown.length === 0 && (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <BellOff size={28} className="text-brand" aria-hidden />
                <p className="font-semibold">You're all caught up</p>
                <p className="text-sm text-mute">Updates from the last 30 days appear here.</p>
              </div>
            )}
            <ul>
              {shown.map((n) => (
                <li key={n.id} className={`flex gap-3 border-b border-line px-6 py-4 ${n.isNew ? 'bg-brand-tint/60' : ''}`}>
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.isNew ? 'bg-brand' : 'bg-transparent'}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold">{n.title}</p>
                      <time dateTime={n.at} className="shrink-0 text-xs text-mute">{ago(n.at)}</time>
                    </div>
                    <p className="mt-1 text-sm text-mute">{n.body}</p>
                    {n.isNew && <span className="sr-only">New</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}

const BASE = import.meta.env.VITE_API_URL || '/api';
const KEY = 'pt_session';

export type Role = 'super_admin' | 'regulator' | 'manufacturer';

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  contact: string;
  sector: string | null;
  wallet_address: string | null;
  must_change_password: boolean;
  profile_pic_url: string | null;
}
export interface Session { token: string; user: SessionUser }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// "Remember me" -> localStorage; otherwise the session ends with the tab.
export function loadSession(): Session | null {
  const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}
export function saveSession(s: Session, remember: boolean) {
  clearSession();
  (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s));
}
export function clearSession() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = loadSession()?.token;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Unable to reach the server. Check your connection.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // An expired or invalid token on a protected call ends the session.
    if (res.status === 401 && token) { clearSession(); window.location.assign('/login'); }
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

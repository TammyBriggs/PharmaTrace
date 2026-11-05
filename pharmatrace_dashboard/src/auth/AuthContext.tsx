import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, clearSession, loadSession, saveSession, sessionIsRemembered, type Session, type SessionUser } from '../lib/api';

interface AuthState {
  user: SessionUser | null;
  login: (contact: string, password: string, remember: boolean) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => void;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession);

  const value = useMemo<AuthState>(() => ({
    user: session?.user ?? null,
    async login(contact, password, remember) {
      const data = await api<{ token: string; user: SessionUser }>('/auth/dashboard-login', {
        method: 'POST',
        body: JSON.stringify({ contact: contact.trim(), password }),
      });
      const s = { token: data.token, user: data.user };
      saveSession(s, remember);
      setSession(s);
    },
    // The server answers with a normal token; it replaces the restricted one issued for a temporary password.
    async changePassword(currentPassword, newPassword) {
      const data = await api<{ token: string; user: SessionUser }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const s = { token: data.token, user: data.user };
      saveSession(s, sessionIsRemembered());
      setSession(s);
    },
    logout() { clearSession(); setSession(null); },
  }), [session]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

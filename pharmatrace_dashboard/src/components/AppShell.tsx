import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Bell, Building2, ChartNoAxesCombined, ChevronDown, ClipboardList, Flag, LayoutDashboard,
  LogOut, Pill, Search, ShieldCheck, ShieldPlus, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL, initials } from '../lib/format';
import WalletChip from './WalletChip';
import type { Role } from '../lib/api';

interface NavItem { to: string; label: string; Icon: LucideIcon; roles: Role[] }

// super_admin sees everything (it acts as regulator + manufacturer in the demo).
export const NAV: NavItem[] = [
  { to: '/overview', label: 'Overview', Icon: LayoutDashboard, roles: ['regulator', 'manufacturer'] },
  { to: '/manufacturers', label: 'Manufacturers', Icon: Building2, roles: ['regulator'] },
  { to: '/batches', label: 'Batches', Icon: Pill, roles: ['regulator', 'manufacturer'] },
  { to: '/analytics', label: 'Scan Analytics', Icon: ChartNoAxesCombined, roles: ['regulator'] },
  { to: '/flag-reports', label: 'Flag Reports', Icon: Flag, roles: ['regulator'] },
  { to: '/audit-log', label: 'Audit Log', Icon: ClipboardList, roles: ['regulator'] },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  if (!user) return null;
  const items = NAV.filter((n) => user.role === 'super_admin' || n.roles.includes(user.role));

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-8 border-r border-line px-4 pb-6 pt-7">
        <div className="flex flex-col gap-3 px-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-8 items-center justify-center rounded-lg bg-brand-tint">
              <ShieldPlus size={24} className="text-brand" aria-hidden />
            </div>
            <span className="text-xl font-semibold">PharmaTrace</span>
          </div>
          <p className="text-xs text-mute">REGULATORY WORKSPACE</p>
        </div>

        <nav aria-label="Primary" className="flex flex-col gap-2">
          {items.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex h-12 items-center gap-3 rounded-lg px-4 text-sm ${
                  isActive ? 'bg-brand-tint font-semibold text-brand' : 'text-mute hover:bg-canvas'}`}>
              <Icon size={20} aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 px-2">
          <ShieldCheck size={20} className="text-brand" aria-hidden />
          <p className="text-xs font-semibold">Rwanda Food and Drugs Authority</p>
          <p className="text-xs text-mute">Supply chain oversight · Rwanda</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-22 shrink-0 items-center justify-between gap-6 border-b border-line px-8">
          <label className="relative block w-100 max-w-full">
            <span className="sr-only">Search</span>
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
            {/* Search is wired up with the Batches module */}
            <input disabled placeholder="Search batch, manufacturer or transaction"
              className="h-10 w-full rounded-lg border border-line bg-canvas pl-10 pr-3 text-sm placeholder:text-mute disabled:cursor-not-allowed" />
          </label>

          <div className="relative flex items-center gap-6">
            <WalletChip />
            <button aria-label="Notifications" className="text-brand"><Bell size={20} /></button>
            <div className="h-8 w-px bg-line" aria-hidden />
            <button onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}
              className="flex items-center gap-3 text-left">
              <span className="flex size-10 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand">
                {initials(user.name)}
              </span>
              <span className="flex flex-col leading-normal">
                <span className="text-sm font-semibold">{user.name}</span>
                <span className="text-xs text-mute">{ROLE_LABEL[user.role]}</span>
              </span>
              <ChevronDown size={16} className="text-mute" aria-hidden />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
                <div role="menu" className="absolute right-0 top-14 z-20 w-48 rounded-lg border border-line bg-white p-1 shadow-card">
                  <button role="menuitem" onClick={logout}
                    className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm hover:bg-canvas">
                    <LogOut size={16} aria-hidden /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="px-8 py-6"><Outlet /></main>
      </div>
    </div>
  );
}

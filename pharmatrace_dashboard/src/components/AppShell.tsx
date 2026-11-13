import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Building2, ChartNoAxesCombined, ChevronDown, ClipboardList, Flag, KeyRound, LayoutDashboard,
  LogOut, MapPinned, Menu, Pill, ShieldCheck, ShieldPlus, Users, X, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL, initials } from '../lib/format';
import WalletChip from './WalletChip';
import NotificationPanel from './NotificationPanel';
import GlobalSearch from './GlobalSearch';
import type { Role } from '../lib/api';
import Modal from './Modal';
import ChangePasswordForm from './ChangePasswordForm';

interface NavItem { to: string; label: string; Icon: LucideIcon; roles: Role[] }

// super_admin sees everything (it acts as regulator + manufacturer in the demo).
export const NAV: NavItem[] = [
  { to: '/overview', label: 'Overview', Icon: LayoutDashboard, roles: ['regulator', 'manufacturer'] },
  { to: '/manufacturers', label: 'Manufacturers', Icon: Building2, roles: ['regulator'] },
  { to: '/pharmacists', label: 'Pharmacists', Icon: Users, roles: ['regulator'] },
  { to: '/batches', label: 'Batches', Icon: Pill, roles: ['regulator', 'manufacturer'] },
  { to: '/analytics', label: 'Scan Analytics', Icon: ChartNoAxesCombined, roles: ['regulator'] },
  { to: '/risk-map', label: 'Risk Map', Icon: MapPinned, roles: ['regulator'] },
  { to: '/flag-reports', label: 'Flag Reports', Icon: Flag, roles: ['regulator'] },
  { to: '/audit-log', label: 'Audit Log', Icon: ClipboardList, roles: ['regulator'] },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [changing, setChanging] = useState(false);
  const [drawer, setDrawer] = useState(false);   // the sidebar slides in over the page below the lg breakpoint
  const { pathname } = useLocation();

  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false); };
    window.addEventListener('keydown', esc);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = before; };
  }, [drawer]);

  if (!user) return null;
  const items = NAV.filter((n) => user.role === 'super_admin' || n.roles.includes(user.role));

  return (
    <div className="flex min-h-screen bg-white">
      {drawer && <div onClick={() => setDrawer(false)} aria-hidden className="fixed inset-0 z-40 bg-ink/30 lg:hidden" />}
      <aside id="primary-sidebar" aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-64 max-w-[85vw] shrink-0 flex-col gap-8 border-r border-line bg-white px-4 pb-6 pt-7 shadow-card transition-[transform,visibility] duration-200 lg:sticky lg:top-0 lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0 lg:shadow-none lg:visible ${
          drawer ? 'translate-x-0' : '-translate-x-full invisible'}`}>
        <div className="flex flex-col gap-3 px-2">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-8 items-center justify-center rounded-lg bg-brand-tint">
                <ShieldPlus size={24} className="text-brand" aria-hidden />
              </div>
              <span className="text-xl font-semibold">PharmaTrace</span>
            </div>
            <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu"
              className="flex size-9 items-center justify-center rounded-lg text-mute hover:bg-canvas lg:hidden"><X size={20} aria-hidden /></button>
          </div>
          <p className="text-xs text-mute">{user.role === 'manufacturer' ? 'MANUFACTURER WORKSPACE' : 'REGULATORY WORKSPACE'}</p>
        </div>

        <nav aria-label="Primary" className="flex min-h-0 flex-col gap-2 overflow-y-auto">
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
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-line px-4 py-3 sm:px-6 lg:h-22 lg:flex-nowrap lg:justify-between lg:gap-6 lg:px-8 lg:py-0">
          <div className="order-1 flex items-center gap-2 lg:hidden">
            <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer} aria-controls="primary-sidebar"
              className="flex size-10 items-center justify-center rounded-lg text-ink hover:bg-canvas"><Menu size={22} aria-hidden /></button>
            <span className="flex h-9 w-8 items-center justify-center rounded-lg bg-brand-tint" aria-hidden><ShieldPlus size={22} className="text-brand" /></span>
            <span className="hidden text-lg font-semibold sm:inline">PharmaTrace</span>
          </div>

          <div className="order-3 w-full lg:order-none lg:w-auto lg:flex-1 lg:max-w-100">
            <GlobalSearch canSearchManufacturers={user.role !== 'manufacturer'} />
          </div>

          <div className="relative order-2 ml-auto flex items-center gap-3 sm:gap-4 lg:order-none lg:gap-6 lg:ml-0">
            <WalletChip />
            <NotificationPanel />
            <div className="hidden h-8 w-px bg-line sm:block" aria-hidden />
            <button onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label={`Account menu for ${user.name}`}
              className="flex items-center gap-3 text-left">
              <span className="flex size-10 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand">
                {initials(user.name)}
              </span>
              <span className="hidden flex-col leading-normal md:flex">
                <span className="text-sm font-semibold">{user.name}</span>
                <span className="text-xs text-mute">{ROLE_LABEL[user.role]}</span>
              </span>
              <ChevronDown size={16} className="hidden text-mute md:block" aria-hidden />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
                <div role="menu" className="absolute right-0 top-14 z-20 w-48 rounded-lg border border-line bg-white p-1 shadow-card">
                  <button role="menuitem" onClick={() => { setMenu(false); setChanging(true); }}
                    className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm hover:bg-canvas">
                    <KeyRound size={16} aria-hidden /> Change password
                  </button>
                  <button role="menuitem" onClick={logout}
                    className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm hover:bg-canvas">
                    <LogOut size={16} aria-hidden /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6"><Outlet /></main>
        {changing && (
          <Modal title="Change password" subtitle="Choose a new password for your account." onClose={() => setChanging(false)}>
            <ChangePasswordForm currentLabel="Current password" onDone={() => setChanging(false)} />
          </Modal>
        )}
      </div>
    </div>
  );
}

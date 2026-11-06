import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, ChevronDown, Network, TriangleAlert, Unplug, Wallet } from 'lucide-react';
import { shortAddr, useWallet, explain } from '../lib/wallet';
import { useAuth } from '../auth/AuthContext';

// Shows wallet state. Only "Connect wallet" and the menu actions ever prompt MetaMask.
// Once connected, the chip opens a small menu: switch account, switch network, disconnect.
export default function WalletChip() {
  const { user } = useAuth();
  const w = useWallet();
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!user) return null;

  const base = 'flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold';
  if (!w.hasProvider) {
    return (
      <a href="https://metamask.io/download" target="_blank" rel="noreferrer"
        className={`${base} border-line text-mute`} title="Needed only for on-chain actions such as approving manufacturers">
        <Wallet size={14} aria-hidden /> MetaMask not detected
      </a>
    );
  }
  if (!w.account) {
    return (
      <div className="flex flex-col items-end">
        <button type="button" className={`${base} border-brand text-brand hover:bg-brand-tint`}
          onClick={() => w.connect().then(() => setErr(null)).catch((e) => setErr(explain(e).message))}>
          <Wallet size={14} aria-hidden /> Connect wallet
        </button>
        {err && <span role="alert" className="absolute top-20 max-w-64 text-xs text-danger">{err}</span>}
      </div>
    );
  }

  const wrongAccount = !!w.linkedWallet && w.account.toLowerCase() !== w.linkedWallet.toLowerCase();
  const wrongNetwork = w.expectedChainId !== null && w.chainId !== null && w.chainId !== w.expectedChainId;
  const network = w.chainName ?? 'the expected network';

  async function run(action: () => Promise<void>, closeAfter = true) {
    setBusy(true); setErr(null);
    try { await action(); if (closeAfter) setOpen(false); }
    catch (e) { setErr(explain(e).message); }
    finally { setBusy(false); }
  }

  const chip = wrongAccount || wrongNetwork
    ? `${base} border-[#fde68a] bg-[#fffbeb] text-[#b45309]`
    : `${base} border-line text-ink hover:bg-canvas`;
  const item = 'flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-canvas disabled:opacity-50';

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen((o) => !o); setErr(null); }} className={chip}
        title={wrongAccount ? `Registered wallet: ${w.linkedWallet}` : wrongNetwork ? `Switch MetaMask to ${network}` : 'Wallet options'}>
        {wrongAccount || wrongNetwork
          ? <TriangleAlert size={14} aria-hidden />
          : <i className="size-2 rounded-full bg-brand" aria-hidden />}
        {wrongAccount ? 'Wrong account' : wrongNetwork ? 'Wrong network' : null}
        {(wrongAccount || wrongNetwork) && ' · '}
        <span className="font-mono">{shortAddr(w.account)}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Wallet options" className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-card">
          <div className="border-b border-line px-4 py-3 text-xs text-mute">
            <p className="font-semibold text-ink">Connected wallet</p>
            <p className="mt-1 break-all font-mono">{w.account}</p>
            {wrongAccount && <p className="mt-2 text-[#b45309]">This is not your registered wallet ({shortAddr(w.linkedWallet!)}). Switch account to continue.</p>}
            {!wrongAccount && wrongNetwork && <p className="mt-2 text-[#b45309]">MetaMask is on the wrong network. Switch to {network}.</p>}
          </div>
          <button type="button" role="menuitem" disabled={busy} className={item} onClick={() => run(w.switchAccount)}>
            <ArrowLeftRight size={16} aria-hidden /> Switch account
          </button>
          {wrongNetwork && (
            <button type="button" role="menuitem" disabled={busy} className={item} onClick={() => run(w.switchNetwork)}>
              <Network size={16} aria-hidden /> Switch to {network}
            </button>
          )}
          <button type="button" role="menuitem" disabled={busy} className={item} onClick={() => run(w.disconnect)}>
            <Unplug size={16} aria-hidden /> Disconnect wallet
          </button>
          {err && <p role="alert" className="border-t border-line px-4 py-2 text-xs text-danger">{err}</p>}
        </div>
      )}
    </div>
  );
}

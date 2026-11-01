import { useState } from 'react';
import { TriangleAlert, Wallet } from 'lucide-react';
import { shortAddr, useWallet, explain } from '../lib/wallet';
import { useAuth } from '../auth/AuthContext';

// Shows wallet state; only the "Connect" button ever prompts MetaMask.
export default function WalletChip() {
  const { user } = useAuth();
  const w = useWallet();
  const [err, setErr] = useState<string | null>(null);
  if (!user || user.role === 'manufacturer') return null;

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
  const warn = `${base} border-[#fde68a] bg-[#fffbeb] text-[#b45309]`;
  if (wrongAccount) {
    return (
      <div className="flex flex-col items-end">
        <button type="button" className={warn} onClick={() => w.switchAccount().then(() => setErr(null)).catch((e) => setErr(explain(e).message))}
          title={`Registered wallet: ${w.linkedWallet}. Click to choose it in MetaMask.`}>
          <TriangleAlert size={14} aria-hidden /> Wrong account · {shortAddr(w.account)} · Switch
        </button>
        {err && <span role="alert" className="absolute top-20 max-w-64 text-xs text-danger">{err}</span>}
      </div>
    );
  }
  if (wrongNetwork) {
    return (
      <div className="flex flex-col items-end">
        <button type="button" className={warn} onClick={() => w.switchNetwork().then(() => setErr(null)).catch((e) => setErr(explain(e).message))}
          title="MetaMask is not on the Hardhat Local network. Click to switch.">
          <TriangleAlert size={14} aria-hidden /> Wrong network · {shortAddr(w.account)} · Switch
        </button>
        {err && <span role="alert" className="absolute top-20 max-w-64 text-xs text-danger">{err}</span>}
      </div>
    );
  }
  return (
    <span className={`${base} border-line text-ink`}>
      <i className="size-2 rounded-full bg-brand" aria-hidden /> <span className="font-mono">{shortAddr(w.account)}</span>
    </span>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BrowserProvider, Contract, type InterfaceAbi } from 'ethers';
import { api } from './api';
import { useAuth } from '../auth/AuthContext';

interface Eip1193 {
  request(a: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, cb: (...args: unknown[]) => void): void;
  removeListener?(event: string, cb: (...args: unknown[]) => void): void;
}
declare global { interface Window { ethereum?: Eip1193 } }

export interface ChainConfig { address: string; chainId: number; rpcUrl: string; abi: InterfaceAbi }

export type WalletErrorCode = 'NO_WALLET' | 'NO_LINKED_WALLET' | 'REJECTED' | 'WRONG_ACCOUNT' | 'CHAIN' | 'REVERT';
export class WalletError extends Error {
  constructor(public code: WalletErrorCode, message: string) { super(message); }
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const REVERTS: Record<string, string> = {
  AccessControlUnauthorizedAccount: 'This wallet does not have the regulator role on the contract.',
  AlreadyRegistered: 'This wallet is already registered as a manufacturer on-chain.',
  NotAManufacturer: 'This wallet is not a registered manufacturer on-chain.',
  EnforcedPause: 'The contract is paused by the administrator.',
  InvalidInput: 'The contract rejected these details as invalid.',
};

/** Turns anything MetaMask/ethers throws into a message a regulator can act on. */
export function explain(e: unknown): WalletError {
  if (e instanceof WalletError) return e;
  const err = e as { code?: unknown; info?: { error?: { code?: number } }; revert?: { name?: string }; shortMessage?: string; message?: string };
  if (err.code === 4001 || err.code === 'ACTION_REJECTED' || err.info?.error?.code === 4001) {
    return new WalletError('REJECTED', 'You cancelled the request in MetaMask. Nothing was changed on-chain.');
  }
  if (err.revert?.name && REVERTS[err.revert.name]) return new WalletError('REVERT', REVERTS[err.revert.name]);
  const msg = err.shortMessage ?? err.message ?? 'The transaction failed.';
  if (/nonce/i.test(msg)) {
    return new WalletError('CHAIN', 'MetaMask’s transaction count is out of sync with the local chain (this happens after restarting the Hardhat node). In MetaMask: Settings → Advanced → Clear activity tab data, then try again.');
  }
  return new WalletError('CHAIN', msg.length > 200 ? `${msg.slice(0, 200)}…` : msg);
}

interface WalletState {
  hasProvider: boolean;
  account: string | null;
  chainId: number | null;
  expectedChainId: number | null;
  linkedWallet: string | null;
  connect: () => Promise<void>;
  /** Prompts as needed, checks network and account, and returns a contract bound to the signer. */
  ensureReady: () => Promise<Contract>;
}
const Ctx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const linked = user?.wallet_address ?? null;
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [config, setConfig] = useState<ChainConfig | null>(null);
  const cfgPromise = useRef<Promise<ChainConfig> | null>(null);
  const hasProvider = typeof window !== 'undefined' && !!window.ethereum;

  const loadConfig = useCallback(() => {
    cfgPromise.current ??= api<ChainConfig>('/chain/config')
      .then((c) => { setConfig(c); return c; })
      .catch((e) => { cfgPromise.current = null; throw e; });   // retry next time (e.g. after deploy)
    return cfgPromise.current;
  }, []);

  // Passive read only: never prompts. Keeps the header chip in sync with MetaMask.
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth || !user) return;
    const readAccounts = (a: unknown) => setAccount(Array.isArray(a) && a[0] ? String(a[0]) : null);
    const readChain = (c: unknown) => setChainId(parseInt(String(c), 16));
    eth.request({ method: 'eth_accounts' }).then(readAccounts).catch(() => {});
    eth.request({ method: 'eth_chainId' }).then(readChain).catch(() => {});
    eth.on?.('accountsChanged', readAccounts);
    eth.on?.('chainChanged', readChain);
    loadConfig().catch(() => {});
    return () => { eth.removeListener?.('accountsChanged', readAccounts); eth.removeListener?.('chainChanged', readChain); };
  }, [user, loadConfig]);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) throw new WalletError('NO_WALLET', 'MetaMask was not detected in this browser. Install it from metamask.io, then reload this page.');
    try {
      const a = await eth.request({ method: 'eth_requestAccounts' });
      setAccount(Array.isArray(a) && a[0] ? String(a[0]) : null);
    } catch (e) { throw explain(e); }
  }, []);

  const ensureReady = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) throw new WalletError('NO_WALLET', 'MetaMask was not detected in this browser. Install it from metamask.io, then reload this page.');
    if (!linked) throw new WalletError('NO_LINKED_WALLET', 'Your account has no wallet linked, so it cannot sign on-chain actions. Ask an administrator to add one.');
    try {
      const cfg = await loadConfig();
      let accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];

      const hex = `0x${cfg.chainId.toString(16)}`;
      if (String(await eth.request({ method: 'eth_chainId' })).toLowerCase() !== hex) {
        try {
          await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
        } catch (e) {
          if ((e as { code?: number }).code !== 4902) throw e;       // 4902: network not added yet
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId: hex, chainName: 'Hardhat Local', rpcUrls: [cfg.rpcUrl], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } }],
          });
        }
        accounts = (await eth.request({ method: 'eth_accounts' })) as string[];
      }

      const match = accounts.find((a) => a.toLowerCase() === linked.toLowerCase());
      if (!match) {
        throw new WalletError('WRONG_ACCOUNT', `Switch MetaMask to your registered wallet ${shortAddr(linked)}, then try again.`);
      }
      const signer = await new BrowserProvider(eth).getSigner(match);
      return new Contract(cfg.address, cfg.abi, signer);
    } catch (e) { throw explain(e); }
  }, [linked, loadConfig]);

  const value = useMemo<WalletState>(() => ({
    hasProvider, account, chainId, expectedChainId: config?.chainId ?? null, linkedWallet: linked, connect, ensureReady,
  }), [hasProvider, account, chainId, config, linked, connect, ensureReady]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWallet must be used inside WalletProvider');
  return v;
}

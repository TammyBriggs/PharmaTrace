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

export interface ChainConfig { address: string; chainId: number; chainName?: string; rpcUrl: string | null; abi: InterfaceAbi }

export type WalletErrorCode = 'SETUP' | 'NO_WALLET' | 'NO_LINKED_WALLET' | 'REJECTED' | 'WRONG_ACCOUNT' | 'CHAIN' | 'REVERT';
export class WalletError extends Error {
  constructor(public code: WalletErrorCode, message: string) { super(message); }
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const REVERTS: Record<string, string> = {
  AccessControlUnauthorizedAccount: 'This wallet does not have the role this action needs on the contract (regulator to approve, flag or revoke; approved manufacturer to submit).',
  AlreadyRegistered: 'This wallet is already registered as a manufacturer on-chain.',
  NotAManufacturer: 'This wallet is not a registered manufacturer on-chain.',
  EnforcedPause: 'The contract is paused by the administrator.',
  InvalidInput: 'The contract rejected these details as invalid.',
  BatchAlreadyExists: 'A batch with this number is already recorded on-chain for this manufacturer.',
  BatchNotFound: 'This batch is not recorded on-chain.',
  InvalidBatchState: 'The batch is in a different state on-chain, so this action no longer applies. Refresh and check its status.',
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
    return new WalletError('CHAIN', 'MetaMask’s transaction count is out of sync with the network. On a local chain this happens after restarting the Hardhat node: in MetaMask go to Settings → Advanced → Clear activity tab data, then try again. On Sepolia, wait for your pending transaction to finish and try again.');
  }
  return new WalletError('CHAIN', msg.length > 200 ? `${msg.slice(0, 200)}…` : msg);
}

/** Switches MetaMask to the contract's network (adding it if needed). No-op when already on it. */
async function switchToChain(eth: Eip1193, cfg: ChainConfig) {
  const hex = `0x${cfg.chainId.toString(16)}`;
  if (String(await eth.request({ method: 'eth_chainId' })).toLowerCase() === hex) return;
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
  } catch (e) {
    if ((e as { code?: number }).code !== 4902) throw e;       // 4902: network not added yet
    if (!cfg.rpcUrl) throw new Error(`Add the ${cfg.chainName ?? 'network'} to MetaMask by hand (chain ID ${cfg.chainId}), then try again.`);
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId: hex, chainName: cfg.chainName ?? 'Hardhat Local', rpcUrls: [cfg.rpcUrl], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } }],
    });
  }
}

interface WalletState {
  hasProvider: boolean;
  account: string | null;
  chainId: number | null;
  expectedChainId: number | null;
  linkedWallet: string | null;
  connect: () => Promise<void>;
  /** Opens MetaMask's account picker so the site can be given a different account. */
  switchAccount: () => Promise<void>;
  /** Switches MetaMask to the Hardhat network. */
  switchNetwork: () => Promise<void>;
  /** Prompts as needed, checks network and account, and returns a contract bound to the signer. */
  ensureReady: () => Promise<Contract>;
}
const Ctx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const linked = user?.wallet_address ?? null;
  const [accounts, setAccounts] = useState<string[]>([]);
  const [chainId, setChainId] = useState<number | null>(null);
  const [config, setConfig] = useState<ChainConfig | null>(null);
  const cfgPromise = useRef<Promise<ChainConfig> | null>(null);
  // MetaMask can permit several accounts at once and lists them in any order, so never trust
  // accounts[0]: prefer the registered wallet whenever it is among the permitted ones.
  const account = useMemo(
    () => accounts.find((a) => !!linked && a.toLowerCase() === linked.toLowerCase()) ?? accounts[0] ?? null,
    [accounts, linked]);
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
    const readAccounts = (a: unknown) => setAccounts(Array.isArray(a) ? a.map(String) : []);
    const readChain = (c: unknown) => setChainId(parseInt(String(c), 16));
    eth.request({ method: 'eth_accounts' }).then(readAccounts).catch(() => {});
    eth.request({ method: 'eth_chainId' }).then(readChain).catch(() => {});
    eth.on?.('accountsChanged', readAccounts);
    eth.on?.('chainChanged', readChain);
    loadConfig().catch(() => {});
    return () => { eth.removeListener?.('accountsChanged', readAccounts); eth.removeListener?.('chainChanged', readChain); };
  }, [user, linked, loadConfig]);

  const switchNetwork = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) throw new WalletError('NO_WALLET', 'MetaMask was not detected in this browser. Install it from metamask.io, then reload this page.');
    try {
      let cfg: ChainConfig;
      try { cfg = await loadConfig(); }
      catch (e) { throw new WalletError('SETUP', `Blockchain not ready: ${(e as Error).message}`); }
      await switchToChain(eth, cfg);
    } catch (e) { throw explain(e); }
  }, [loadConfig]);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) throw new WalletError('NO_WALLET', 'MetaMask was not detected in this browser. Install it from metamask.io, then reload this page.');
    try {
      let a = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      // If this site was already permitted with a different account (e.g. the super admin's), MetaMask
      // returns that account without asking. Open the account picker so the registered wallet can be chosen.
      if (linked && !a.some((x) => x.toLowerCase() === linked.toLowerCase())) {
        await eth.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
        a = (await eth.request({ method: 'eth_accounts' })) as string[];
      }
      setAccounts(Array.isArray(a) ? a.map(String) : []);
      await switchNetwork().catch(() => {});   // the chip offers a Switch button if this is declined or the chain isn't ready
    } catch (e) { throw explain(e); }
  }, [linked, switchNetwork]);

  const switchAccount = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) throw new WalletError('NO_WALLET', 'MetaMask was not detected in this browser. Install it from metamask.io, then reload this page.');
    try {
      await eth.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
      const a = (await eth.request({ method: 'eth_accounts' })) as string[];
      setAccounts(Array.isArray(a) ? a.map(String) : []);
    } catch (e) { throw explain(e); }
  }, []);

  const ensureReady = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) throw new WalletError('NO_WALLET', 'MetaMask was not detected in this browser. Install it from metamask.io, then reload this page.');
    if (!linked) throw new WalletError('NO_LINKED_WALLET', 'Your account has no wallet linked, so it cannot sign on-chain actions. Ask an administrator to add one.');
    try {
      let cfg: ChainConfig;
      try { cfg = await loadConfig(); }
      catch (e) { throw new WalletError('SETUP', `Blockchain not ready: ${(e as Error).message}`); }   // server/chain setup, not a wallet problem
      let accs = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      setAccounts(accs);

      await switchToChain(eth, cfg);
      accs = (await eth.request({ method: 'eth_accounts' })) as string[];
      setAccounts(accs);

      const match = accs.find((a) => a.toLowerCase() === linked.toLowerCase());
      if (!match) {
        throw new WalletError('WRONG_ACCOUNT', `Switch MetaMask to your registered wallet ${shortAddr(linked)}, then try again.`);
      }
      const signer = await new BrowserProvider(eth).getSigner(match);
      return new Contract(cfg.address, cfg.abi, signer);
    } catch (e) { throw explain(e); }
  }, [linked, loadConfig]);

  const value = useMemo<WalletState>(() => ({
    hasProvider, account, chainId, expectedChainId: config?.chainId ?? null, linkedWallet: linked, connect, switchAccount, switchNetwork, ensureReady,
  }), [hasProvider, account, chainId, config, linked, connect, switchAccount, switchNetwork, ensureReady]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWallet must be used inside WalletProvider');
  return v;
}

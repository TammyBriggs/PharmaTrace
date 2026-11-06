import { useCallback, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, ChevronDown, Loader2, ShieldCheck, TriangleAlert, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { explain, shortAddr, useWallet, type WalletErrorCode } from '../lib/wallet';
import TxLink from './TxLink';
import { explorerUrl, fmtDateTime, reasonHashOf, shortHash, type BatchDetail, type Totals } from '../lib/batches';
import Modal, { btnPrimary, btnSecondary } from './Modal';
import { StatusChip } from './ui';

export type ActionKind = 'approve' | 'flag' | 'resolve' | 'revoke' | 'reinstate';
export interface BatchRef { id: string; batchNo: string; drugName: string }
export interface ActionDone { kind: ActionKind; batch: BatchDetail; totals: Totals; txHash: string }

interface Tx {
  b: BatchRef; kind: ActionKind; stage: 'wallet' | 'chain' | 'record' | 'error';
  hash?: string; reason?: string; notes?: string; error?: string; errCode?: WalletErrorCode;
}

const COPY: Record<ActionKind, { verb: string; done: string; sub: string; line: string | null }> = {
  approve:   { verb: 'Approve batch', done: 'Batch approved successfully', sub: 'The approval is now recorded in the audit log.', line: 'Verification results now show this batch as Authentic.' },
  flag:      { verb: 'Flag batch', done: 'Batch flagged successfully', sub: 'The counterfeit flag is now recorded in the audit log.', line: 'Verification results now show this batch as Flagged.' },
  resolve:   { verb: 'Resolve flag', done: 'Flag resolved', sub: 'The resolution is now recorded in the audit log.', line: null },
  revoke:    { verb: 'Revoke batch', done: 'Batch revoked successfully', sub: 'The revocation is now recorded in the audit log.', line: 'Verification results now show this batch as Revoked.' },
  reinstate: { verb: 'Reinstate batch', done: 'Batch reinstated', sub: 'The reinstatement is now recorded in the audit log.', line: null },
};

const field = 'w-full rounded-lg border border-line bg-white p-3 text-sm outline-none placeholder:text-mute/70 focus:border-brand focus:ring-2 focus:ring-brand/20';

/**
 * Runs regulator actions end to end: (optional reason form) -> MetaMask signature -> chain confirmation -> server records it
 * from the receipt. The server never signs; it re-reads the transaction and checks it matches this batch and this wallet.
 */
export function useBatchActions(reasons: string[], onDone: (d: ActionDone) => void) {
  const { ensureReady } = useWallet();
  const [form, setForm] = useState<{ b: BatchRef; kind: 'flag' | 'revoke' } | null>(null);
  const [tx, setTx] = useState<Tx | null>(null);
  const [done, setDone] = useState<(ActionDone & { b: BatchRef; reason?: string; notes?: string }) | null>(null);

  const record = useCallback(async (b: BatchRef, kind: ActionKind, hash: string, reason?: string, notes?: string) => {
    setTx({ b, kind, stage: 'record', hash, reason, notes });
    try {
      const r = await api<{ batch: BatchDetail; totals: Totals }>(`/batches/${b.id}/confirm-action`,
        { method: 'POST', body: JSON.stringify({ txHash: hash, reason, notes }) });
      setTx(null);
      const d = { kind, batch: r.batch, totals: r.totals, txHash: hash, b, reason, notes };
      if (kind === 'flag' || kind === 'revoke') setDone(d);
      onDone(d);
    } catch (e) {
      setTx({ b, kind, stage: 'error', hash, reason, notes,
        error: `The transaction succeeded on-chain, but saving it failed: ${(e as Error).message} You can retry; the on-chain action will not be repeated.` });
    }
  }, [onDone]);

  const run = useCallback(async (b: BatchRef, kind: ActionKind, reason?: string, notes?: string) => {
    setTx({ b, kind, stage: 'wallet', reason, notes });
    let hash: string | undefined;
    try {
      // The on-chain id is derived from the manufacturer's wallet, so read it from the server record first.
      const { batch } = await api<{ batch: BatchDetail }>(`/batches/${b.id}`);
      const contract = await ensureReady();
      const sent = kind === 'approve' ? await contract.approveBatch(batch.batchIdHash)
        : kind === 'flag' ? await contract.flagBatch(batch.batchIdHash, reasonHashOf(reason!, notes!))
        : kind === 'resolve' ? await contract.resolveFlag(batch.batchIdHash)
        : kind === 'revoke' ? await contract.revokeBatch(batch.batchIdHash, reasonHashOf(reason!, notes!))
        : await contract.reinstateBatch(batch.batchIdHash);
      hash = sent.hash as string;
      setTx({ b, kind, stage: 'chain', hash, reason, notes });
      await sent.wait();
      await record(b, kind, hash, reason, notes);
    } catch (e) {
      const w = explain(e);
      setTx({ b, kind, stage: 'error', hash, reason, notes, error: w.message, errCode: w.code });
    }
  }, [ensureReady, record]);

  const start = useCallback((b: BatchRef, kind: ActionKind) => {
    if (kind === 'flag' || kind === 'revoke') setForm({ b, kind });
    else void run(b, kind);
  }, [run]);

  const node: ReactNode = (
    <>
      {form && (
        <ReasonForm b={form.b} kind={form.kind} reasons={reasons} onCancel={() => setForm(null)}
          onContinue={(reason, notes) => { const f = form; setForm(null); void run(f.b, f.kind, reason, notes); }} />
      )}
      {tx && <TxDialog tx={tx} onClose={() => setTx(null)}
        onRetry={() => (tx.hash ? void record(tx.b, tx.kind, tx.hash, tx.reason, tx.notes) : void run(tx.b, tx.kind, tx.reason, tx.notes))} />}
      {done && <DoneDialog d={done} onClose={() => setDone(null)} />}
    </>
  );
  return { start, node };
}

function ReasonForm({ b, kind, reasons, onCancel, onContinue }: {
  b: BatchRef; kind: 'flag' | 'revoke'; reasons: string[]; onCancel: () => void; onContinue: (reason: string, notes: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [ok, setOk] = useState(false);
  const flag = kind === 'flag';
  const valid = !!reason && notes.trim().length >= 10 && ok;
  return (
    <Modal title={flag ? 'Flag batch' : 'Revoke batch'} subtitle={`${b.batchNo} · ${b.drugName}`} onClose={onCancel}>
      <p className="text-xs font-semibold text-brand">STEP 1 OF 2 · REVIEW {flag ? 'FLAG' : 'REVOCATION'} DETAILS</p>
      <div className="flex items-center gap-3 rounded-lg bg-[#fffbeb] p-4 text-sm text-[#b45309]">
        <CircleAlert size={20} className="shrink-0" aria-hidden />
        {flag ? 'Flagging will warn healthcare workers that this batch may be counterfeit.'
          : 'Revoking will make every unit of this batch fail public verification. It can be reinstated later.'}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="fb-reason" className="text-sm font-semibold">Reason *</label>
        <div className="relative">
          <select id="fb-reason" value={reason} onChange={(e) => setReason(e.target.value)}
            className={`${field} h-11 appearance-none pr-10 ${reason ? '' : 'text-mute'}`}>
            <option value="">Select a reason</option>
            {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand" aria-hidden />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="fb-notes" className="text-sm font-semibold">Notes *</label>
        <textarea id="fb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000}
          placeholder="Describe the evidence and location…" className={`${field} h-26 resize-none`} />
        <p className="text-xs text-mute">At least 10 characters. These notes are signed into the transaction as a hash and stored in the audit log.</p>
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#0f766e]" />
        I confirm that I have reviewed the evidence and understand this {flag ? 'flag' : 'revocation'} will affect public verification results.
      </label>
      <div className="flex items-start gap-3 rounded-lg bg-canvas p-4">
        <Wallet size={20} className="shrink-0 text-brand" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Next: Sign transaction with your wallet</p>
          <p className="text-xs text-mute">A confirmation request will open in your connected wallet.</p>
        </div>
      </div>
      <div className="flex justify-between">
        <button type="button" className={btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="button" disabled={!valid} onClick={() => onContinue(reason, notes.trim())}
          className={`h-10 rounded-lg border px-4 text-sm font-semibold ${valid ? 'border-brand bg-brand text-white hover:brightness-95' : 'cursor-not-allowed border-line bg-line text-mute'}`}>
          Continue to wallet
        </button>
      </div>
    </Modal>
  );
}

export function TxDialog({ tx, onClose, onRetry }: { tx: Tx; onClose: () => void; onRetry: () => void }) {
  const failed = tx.stage === 'error';
  const url = tx.hash ? explorerUrl(tx.hash) : null;
  const copy = COPY[tx.kind];
  if (failed) {
    return (
      <Modal title={tx.errCode === 'SETUP' ? 'Blockchain not ready' : 'Transaction not completed'} subtitle={`${tx.b.batchNo} · ${tx.b.drugName}`} onClose={onClose}>
        <div role="alert" className="flex items-start gap-3 rounded-lg bg-[#fef2f2] p-4 text-sm text-[#b91c1c]">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden /> {tx.error}
        </div>
        {tx.errCode === 'SETUP' && <p className="text-sm text-mute">This is a server or blockchain set-up issue, not a wallet problem. Start the Hardhat node, run the deploy script, then try again.</p>}
        <div className="flex justify-end gap-3">
          <button className={btnSecondary} onClick={onClose}>Close</button>
          <button className={btnPrimary} onClick={onRetry}>{tx.hash ? 'Retry saving' : 'Try again'}</button>
        </div>
      </Modal>
    );
  }
  const waiting = tx.stage === 'wallet';
  return (
    <Modal title="Sign transaction with your wallet" subtitle={`${copy.verb} · ${tx.b.batchNo}`} onClose={onClose} busy>
      <div role="status" className="flex items-start gap-3 rounded-lg bg-[#fffbeb] p-4 text-[#b45309]">
        <Loader2 size={20} className="mt-0.5 shrink-0 animate-spin" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">
            {waiting ? 'Waiting for your signature' : tx.stage === 'chain' ? 'Waiting for confirmation' : 'Recording in the audit log'}
          </p>
          <p className="text-sm">
            {waiting ? 'Approve the request in the MetaMask window. Nothing changes until you sign.'
              : 'Your wallet signature was received. The transaction is pending; batch status will change only after confirmation.'}
          </p>
        </div>
      </div>
      <dl className="flex flex-col gap-2 rounded-lg bg-canvas p-4 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-mute">Action</dt><dd className="font-semibold">{copy.verb}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-mute">Batch</dt><dd className="font-mono text-xs">{tx.b.batchNo}</dd></div>
        {tx.reason && <div className="flex justify-between gap-4"><dt className="text-mute">Reason</dt><dd>{tx.reason}</dd></div>}
        <div className="flex justify-between gap-4"><dt className="text-mute">Transaction</dt><dd>{tx.hash ? <TxLink hash={tx.hash} /> : <span className="text-xs text-mute">Not sent yet</span>}</dd></div>
      </dl>
      <p className="text-xs text-mute">Keep this window open until the transaction is confirmed.</p>
      <div className="flex justify-between">
        {url ? <a href={url} target="_blank" rel="noreferrer" className={`${btnSecondary} flex items-center`}>View transaction</a> : <span />}
        <button disabled className={btnPrimary}>Confirming transaction…</button>
      </div>
    </Modal>
  );
}

function DoneDialog({ d, onClose }: { d: ActionDone & { b: BatchRef; reason?: string; notes?: string }; onClose: () => void }) {
  const c = COPY[d.kind];
  const last = d.batch.events[d.batch.events.length - 1];
  const t = d.totals;
  return (
    <Modal title={c.done} subtitle={c.sub} onClose={onClose}>
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-brand-tint p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck size={40} className="shrink-0 text-brand" aria-hidden />
          <div className="flex flex-col gap-1">
            <StatusChip kind={d.batch.status} />
            <b className="text-sm">Transaction confirmed</b>
          </div>
        </div>
        {c.line && <p className="text-sm text-mute">{c.line}</p>}
        <dl className="flex flex-col gap-1.5 text-sm">
          {d.reason && <div className="flex justify-between gap-4"><dt className="text-mute">Reason</dt><dd className="text-right">{d.reason}</dd></div>}
          {d.notes && <div className="flex justify-between gap-4"><dt className="text-mute">Notes</dt><dd className="line-clamp-2 text-right">{d.notes}</dd></div>}
          <div className="flex justify-between gap-4"><dt className="text-mute">Transaction</dt><dd><TxLink hash={d.txHash} /></dd></div>
          {last && <div className="flex justify-between gap-4"><dt className="text-mute">Time</dt><dd>{fmtDateTime(last.at)}</dd></div>}
          {last && <div className="flex justify-between gap-4"><dt className="text-mute">Signer</dt><dd className="font-mono text-xs" title={last.wallet}>{shortAddr(last.wallet)}</dd></div>}
        </dl>
      </div>
      <p className="text-sm text-mute">Post-action totals: {t.flagged} flagged · {t.pending} pending · {t.approved} approved{t.revoked ? ` · ${t.revoked} revoked` : ''}.</p>
      <div className="flex justify-end gap-3">
        <button className={btnSecondary} onClick={onClose}>Close</button>
        <Link to={`/batches/${d.b.id}`} onClick={onClose} className={`${btnPrimary} flex items-center`}>View batch</Link>
      </div>
    </Modal>
  );
}

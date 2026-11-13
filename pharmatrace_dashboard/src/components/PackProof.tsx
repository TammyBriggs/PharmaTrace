import { useState, type FormEvent } from 'react';
import { Fingerprint, Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { api } from '../lib/api';
import { num } from '../lib/format';
import type { BatchDetail } from '../lib/batches';
import { Card } from './ui';
import { btnPrimary } from './Modal';
import TxLink from './TxLink';

interface Proof {
  anchored: boolean; message?: string; serial?: string; inBatch?: boolean; proof?: string[]; leaf?: string;
  onChain?: { serialAuthorised: boolean; verdict: string | null } | null;
}

/** Shows the batch's serial Merkle root (stored on-chain at submission) and lets a regulator prove that one pack belongs to it. */
export default function PackProof({ batch }: { batch: BatchDetail }) {
  const [serial, setSerial] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Proof | null>(null);

  async function check(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setRes(null);
    try { setRes(await api<Proof>(`/serials/batch/${batch.id}/proof?serial=${encodeURIComponent(serial.trim())}`)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not check that serial.'); }
    finally { setBusy(false); }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2"><Fingerprint size={20} className="text-brand" aria-hidden /><h2 className="text-lg font-semibold">Pack authenticity on the blockchain</h2></div>
      {!batch.serialRoot ? (
        <p className="text-sm text-mute">This batch was submitted before pack anchoring existed, so its individual packs are not covered by an on-chain proof.</p>
      ) : (
        <>
          <p className="text-sm text-mute">
            When this batch was submitted, one fingerprint (a Merkle root) of all {num(batch.serialCount ?? 0)} pack serial numbers was written to the blockchain.
            The serials themselves are not on-chain. Any single pack can be proven to belong to this batch, and the contract checks the proof itself.
          </p>
          <dl className="grid grid-cols-[minmax(0,1fr)] gap-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt className="text-mute">Serial root</dt><dd className="break-all font-mono text-xs">{batch.serialRoot}</dd>
            <dt className="text-mute">Packs covered</dt><dd>{num(batch.serialCount ?? 0)}</dd>
            <dt className="text-mute">Recorded in</dt><dd><TxLink hash={batch.submitTxHash} /></dd>
          </dl>
          <form onSubmit={check} className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-semibold">Check a pack serial
              <input value={serial} onChange={(e) => setSerial(e.target.value.toUpperCase())} placeholder="e.g. the 12 characters after /21/ in a pack code"
                className="h-11 rounded-lg border border-line bg-white p-3 font-mono text-sm font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            </label>
            <button type="submit" disabled={busy || serial.trim().length < 6} className={`${btnPrimary} flex h-11 items-center gap-2`}>
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden />} Prove it
            </button>
          </form>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {res && (
            <div role="status" className={`flex items-start gap-3 rounded-lg p-4 text-sm ${res.inBatch && res.onChain?.serialAuthorised ? 'bg-[#f0fdfa] text-[#0f766e]' : res.inBatch && !res.onChain ? 'bg-canvas' : 'bg-[#fef2f2] text-[#b91c1c]'}`}>
              {res.inBatch && res.onChain?.serialAuthorised ? <ShieldCheck size={20} className="mt-0.5 shrink-0" aria-hidden /> : <ShieldX size={20} className="mt-0.5 shrink-0" aria-hidden />}
              <div className="flex flex-col gap-1">
                {!res.inBatch && <b>{res.message ?? 'This serial is not part of this batch.'}</b>}
                {res.inBatch && res.onChain?.serialAuthorised && <><b>The contract confirms this pack belongs to this batch.</b><span>Batch status on-chain: {res.onChain.verdict}. Proof length: {res.proof?.length} hashes.</span></>}
                {res.inBatch && res.onChain && !res.onChain.serialAuthorised && <b>The contract did not accept this proof.</b>}
                {res.inBatch && !res.onChain && <><b>The proof was built, but the blockchain node could not be reached to confirm it.</b><span>Try again in a moment.</span></>}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

import { ExternalLink } from 'lucide-react';
import { explorerUrl, shortHash } from '../lib/batches';

/** A transaction hash. On a public network (VITE_EXPLORER_URL set) it opens the block explorer; locally it is plain text. */
export default function TxLink({ hash, className = '' }: { hash: string; className?: string }) {
  const url = explorerUrl(hash);
  const cls = `font-mono text-xs text-brand ${className}`;
  return url
    ? <a href={url} target="_blank" rel="noreferrer" title={`${hash} (opens the block explorer)`} className={`${cls} inline-flex items-center gap-1 hover:underline`}>{shortHash(hash)} <ExternalLink size={12} aria-hidden /></a>
    : <span title={hash} className={cls}>{shortHash(hash)}</span>;
}

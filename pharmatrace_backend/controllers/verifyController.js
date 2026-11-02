const jwt = require('jsonwebtoken');
const { Contract } = require('ethers');
const pool = require('../config/db');
const { getProvider, assertDeployed } = require('../config/chain');
const { recordAudit } = require('../utils/audit');
const { parseDigitalLink } = require('../utils/gs1');

// ───────────────────────── verdict logic ─────────────────────────
const SEVERITY = { authentic: 1, pending: 2, expired: 3, flagged: 4, revoked: 5 };
// Contract Verdict enum: NotFound, Authentic, Pending, Flagged, Expired, ManufacturerRevoked, BatchRevoked
const CHAIN_KEY = [null, 'authentic', 'pending', 'flagged', 'expired', 'revoked', 'revoked'];

const MESSAGES = {
  authentic: { pack: 'This pack is registered and approved by the regulator.', batch: 'This batch is registered and approved by the regulator.' },
  duplicate: { pack: 'This pack was already recorded as dispensed. Do not dispense it again. It may be a copy.' },
  pending: { pack: 'This batch has not been approved by the regulator yet. Do not dispense it.', batch: 'This batch has not been approved by the regulator yet.' },
  flagged: { pack: 'This batch has been flagged as possibly counterfeit. Do not dispense it. Report it to the Rwanda FDA.', batch: 'This batch has been flagged as possibly counterfeit.' },
  expired: { pack: 'This batch has passed its expiry date. Do not dispense it.', batch: 'This batch has passed its expiry date.' },
  revoked: { pack: 'This batch or its manufacturer has been revoked. Do not dispense it.', batch: 'This batch or its manufacturer has been revoked.' },
  not_found: { pack: 'No matching pack was found in the PharmaTrace register. Treat it as suspicious.', batch: 'No matching batch was found in the PharmaTrace register.' },
};

const today = () => new Date().toISOString().slice(0, 10);

/** Verdict from the database, in the same order of checks as the contract's verifyBatch. */
function dbVerdict(row) {
  if (row.status === 'flagged') return 'flagged';
  if (row.status === 'revoked') return 'revoked';
  if (row.manufacturer_status === 'revoked') return 'revoked';
  if (row.status === 'pending') return 'pending';
  if (row.expiry_day <= today()) return 'expired';   // chain: block.timestamp > expiry (midnight UTC of the expiry day)
  return 'authentic';
}

/** Reads the verdict straight from the contract; null when the chain is unreachable or does not know the batch. */
async function chainVerdict(row) {
  try {
    const dep = await assertDeployed();
    const c = new Contract(dep.address, dep.abi, getProvider());
    const res = await Promise.race([
      c.verifyBatch(row.batch_id_hash),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500)),
    ]);
    return CHAIN_KEY[Number(res[0])] ?? null;
  } catch { return null; }
}

const SELECT = `SELECT b.id AS batch_uuid, b.batch_no, b.gtin, b.drug_name, b.category, b.status, b.batch_id_hash,
       to_char(b.expiry_date,'YYYY-MM-DD') AS expiry_day, to_char(b.mfg_date,'YYYY-MM-DD') AS mfg_day,
       m.name AS manufacturer_name, m.status AS manufacturer_status,
       p.brand_name, p.generic_name, p.strength, p.dosage_form, p.pack_size`;
const FROM = `FROM batches b JOIN manufacturers m ON m.id = b.manufacturer_id LEFT JOIN products p ON p.id = b.product_id`;

async function lookup({ gtin, batchNo, serial }) {
  if (serial) {
    return (await pool.query(
      `${SELECT}, s.id AS serial_id, s.status AS serial_status,
              to_char(s.dispensed_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS dispensed_at
         ${FROM} JOIN serials s ON s.batch_uuid = b.id
        WHERE b.gtin = $1 AND b.batch_no = $2 AND s.serial = $3 AND b.status <> 'draft' LIMIT 1`, [gtin, batchNo, serial])).rows[0] ?? null;
  }
  return (await pool.query(`${SELECT} ${FROM} WHERE b.gtin = $1 AND b.batch_no = $2 AND b.status <> 'draft' LIMIT 1`, [gtin, batchNo])).rows[0] ?? null;
}

/** Combines the database and the chain (worst result wins) and then applies the per-pack state. */
async function evaluate(parts) {
  const row = await lookup(parts);
  if (!row) return { verdict: 'not_found', row: null, source: 'database', chain: null };
  let verdict = dbVerdict(row);
  const chain = await chainVerdict(row);
  if (chain && SEVERITY[chain] > SEVERITY[verdict]) verdict = chain;     // e.g. flagged on-chain but the database lags
  if (parts.serial) {
    if (row.serial_status === 'revoked') verdict = 'revoked';
    else if (row.serial_status === 'dispensed' && verdict === 'authentic') verdict = 'duplicate';
  }
  return { verdict, row, source: chain ? 'blockchain + database' : 'database', chain };
}

function present({ verdict, row, source }, parts) {
  const scope = parts.serial ? 'pack' : 'batch';
  return {
    verdict,
    scope,
    message: (MESSAGES[verdict][scope] ?? MESSAGES[verdict].pack),
    batch: row && {
      id: row.batch_uuid, batchNo: row.batch_no, gtin: row.gtin, drugName: row.drug_name, category: row.category,
      brandName: row.brand_name, genericName: row.generic_name, strength: row.strength, dosageForm: row.dosage_form,
      packSize: row.pack_size, manufacturer: row.manufacturer_name, mfgDate: row.mfg_day, expiryDate: row.expiry_day,
    },
    serial: parts.serial ? { value: parts.serial, status: row?.serial_status ?? null, dispensedAt: row?.dispensed_at ?? null } : null,
    source,
    checkedAt: new Date().toISOString(),
  };
}

// ───────────────────────── scan log ─────────────────────────
async function logScan(parts, r, rawCode, userId) {
  try {
    let sector = null;
    if (userId) sector = (await pool.query('SELECT sector FROM users WHERE id = $1', [userId])).rows[0]?.sector ?? null;
    await pool.query(
      `INSERT INTO scan_events (batch_uuid, serial, raw_code, sector, verdict, scanned_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [r.row?.batch_uuid ?? null, parts.serial, String(rawCode ?? '').slice(0, 500) || null, sector, r.verdict, userId ?? null]);
  } catch (e) { console.error('Could not log scan:', e.message); }   // verification must never fail because logging did
}

/** Public routes work without a token; if a valid one is sent we also record who scanned and from which sector. */
function optionalAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) { try { req.user = jwt.verify(h.slice(7), process.env.JWT_SECRET); } catch { /* treat as public */ } }
  next();
}

// Small in-memory limiter for the public endpoints (the full rate-limiting task replaces this).
const hits = new Map();
function limiter(max = 60, windowMs = 60_000) {
  return (req, res, next) => {
    const key = req.ip, now = Date.now();
    const e = hits.get(key);
    if (!e || now > e.reset) hits.set(key, { n: 1, reset: now + windowMs });
    else if (++e.n > max) { res.set('Retry-After', String(Math.ceil((e.reset - now) / 1000))); return res.status(429).json({ error: 'Too many scans. Please wait a moment and try again.' }); }
    if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    next();
  };
}

const partsFromRequest = (src) => {
  if (src.code) return parseDigitalLink(src.code);
  if (src.gtin && src.batch) return parseDigitalLink(`/01/${src.gtin}/10/${encodeURIComponent(src.batch)}${src.serial ? `/21/${src.serial}` : ''}`);
  return null;
};

// ───────────────────────── GET /api/verify ─────────────────────────
const verifyApi = async (req, res) => {
  try {
    const parts = partsFromRequest(req.query);
    if (!parts || !parts.batchNo) return res.status(400).json({ error: 'That is not a PharmaTrace pack code.' });
    const r = await evaluate(parts);
    await logScan(parts, r, req.query.code ?? `${req.query.gtin}/${req.query.batch}/${req.query.serial ?? ''}`, req.user?.id);
    res.set('Cache-Control', 'no-store').status(200).json(present(r, parts));
  } catch (e) { console.error('Error in verify:', e.message); res.status(500).json({ error: 'Server error while verifying' }); }
};

// ───────────────────────── POST /api/serials/dispense (pharmacist) ─────────────────────────
const dispense = async (req, res) => {
  try {
    const parts = partsFromRequest(req.body);
    if (!parts || !parts.batchNo || !parts.serial) return res.status(400).json({ error: 'Scan the code printed on the individual pack.' });
    const r = await evaluate(parts);
    if (!r.row) return res.status(404).json({ error: MESSAGES.not_found.pack, code: 'NOT_FOUND' });
    if (r.verdict === 'duplicate') {
      return res.status(409).json({ error: MESSAGES.duplicate.pack, code: 'ALREADY_DISPENSED', dispensedAt: r.row.dispensed_at });
    }
    if (r.verdict !== 'authentic') {
      return res.status(409).json({ error: MESSAGES[r.verdict].pack, code: 'NOT_DISPENSABLE', verdict: r.verdict });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // One atomic UPDATE: of two simultaneous requests for the same pack, only one can match status = 'active'.
      const u = await client.query(
        `UPDATE serials SET status = 'dispensed', dispensed_at = now(), dispensed_by = $2, updated_at = now()
          WHERE id = $1 AND status = 'active' RETURNING to_char(dispensed_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS dispensed_at`,
        [r.row.serial_id, req.user.id]);
      if (!u.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ error: MESSAGES.duplicate.pack, code: 'ALREADY_DISPENSED' }); }
      const who = (await client.query('SELECT sector, wallet_address FROM users WHERE id = $1', [req.user.id])).rows[0] ?? {};
      await recordAudit({ actor_id: req.user.id, actor_wallet: who.wallet_address ?? null, action: 'serial.dispense', entity_type: 'serial',
        entity_id: r.row.serial_id, details: { batchNo: r.row.batch_no, serial: parts.serial, sector: who.sector ?? null } }, client);
      await client.query('COMMIT');
      const out = present({ ...r, verdict: 'duplicate' }, parts);
      res.status(200).json({ dispensed: true, dispensedAt: u.rows[0].dispensed_at, batch: out.batch, serial: { value: parts.serial, status: 'dispensed', dispensedAt: u.rows[0].dispensed_at } });
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  } catch (e) { console.error('Error dispensing:', e.message); res.status(500).json({ error: 'Server error while recording the sale' }); }
};

// ───────────────────────── public web page (what a phone camera opens) ─────────────────────────
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (d) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  ok: svg('<path d="M20 6 9 17l-5-5"/>'), warn: svg('<path d="M12 8v5M12 17h.01"/>'), no: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'), ask: svg('<path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>'),
};
const SHIELD = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.7 8.97a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v6M9 11h6"/></svg>';
const THEME = {
  authentic: ['#f0fdfa', '#0f766e', 'Authentic', ICON.ok], pending: ['#fffbeb', '#b45309', 'Pending approval', ICON.clock],
  expired: ['#fffbeb', '#b45309', 'Expired', ICON.clock], flagged: ['#fef2f2', '#b91c1c', 'Flagged', ICON.warn],
  revoked: ['#fef2f2', '#b91c1c', 'Revoked', ICON.no], duplicate: ['#fef2f2', '#b91c1c', 'Already dispensed', ICON.warn],
  not_found: ['#f3f4f6', '#4b5563', 'Not found', ICON.ask],
};
// Times are shown in Kigali time (override with DISPLAY_TIMEZONE in .env).
const TZ = process.env.DISPLAY_TIMEZONE || 'Africa/Kigali';
const TZ_LABEL = TZ === 'Africa/Kigali' ? 'CAT' : TZ;
function fmtDateTime(iso) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ${TZ_LABEL}`;
}
const fmtDay = (d) => { if (!d) return ''; const [y, m, dd] = d.split('-').map(Number); return `${String(dd).padStart(2, '0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} ${y}`; };

function renderPage(out) {
  const [bg, fg, label, icon] = THEME[out.verdict];
  const b = out.batch;
  const rows = b ? [
    ['Medicine', [b.brandName, b.genericName && b.strength ? `${b.genericName} ${b.strength}` : b.drugName].filter(Boolean).join(' · ')],
    ['Form', [b.dosageForm, b.packSize].filter(Boolean).join(' · ')], ['Manufacturer', b.manufacturer],
    ['Batch', b.batchNo], ['Expiry', fmtDay(b.expiryDate)],
    ...(out.serial ? [['Pack serial', out.serial.value], ['Dispensed', out.serial.dispensedAt ? fmtDateTime(out.serial.dispensedAt) : 'No']] : []),
  ].filter(([, v]) => v) : [];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(label)} · PharmaTrace</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f9fafb;color:#111827;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:480px;margin:0 auto;padding:24px 16px 40px}.brand{display:flex;align-items:center;gap:8px;font-weight:600;font-size:18px;margin-bottom:20px;color:#0f766e}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px}.verdict{background:${bg};color:${fg};border-radius:12px;padding:20px;display:flex;gap:14px;align-items:flex-start}
.icon{flex:none;width:44px;height:44px;border-radius:50%;background:#fff;color:${fg};display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700}
h1{margin:0 0 4px;font-size:22px}p{margin:0}dl{margin:16px 0 0}dt{font-size:12px;color:#4b5563;margin-top:12px}dd{margin:2px 0 0;font-weight:600;word-break:break-word}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace}.note{font-size:12px;color:#4b5563;margin-top:16px}</style></head><body><main>
<div class="brand">${SHIELD} PharmaTrace</div>
<div class="verdict" role="status"><div class="icon">${icon}</div><div><h1>${esc(label)}</h1><p>${esc(out.message)}</p></div></div>
${rows.length ? `<div class="card" style="margin-top:16px"><dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd${k === 'Batch' || k === 'Pack serial' ? ' class="mono"' : ''}>${esc(v)}</dd>`).join('')}</dl></div>` : ''}
${out.scope === 'batch' ? '<p class="note">This code identifies a whole batch, not a single pack. Scan the code printed on the pack itself to check that pack.</p>' : ''}
<p class="note">Checked ${esc(fmtDateTime(out.checkedAt))} against: ${esc(out.source)}.</p>
</main></body></html>`;
}

const verifyPage = async (req, res) => {
  const p = req.params;
  const parts = parseDigitalLink(`/01/${p.gtin}${p.batch ? `/10/${encodeURIComponent(p.batch)}` : ''}${p.serial ? `/21/${p.serial}` : ''}`);
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" });
  try {
    if (!parts || !parts.batchNo) {
      return res.status(400).type('html').send(renderPage({ verdict: 'not_found', scope: 'batch', message: 'This is not a complete PharmaTrace code. Scan the code printed on the pack.', batch: null, serial: null, source: 'database', checkedAt: new Date().toISOString() }));
    }
    const r = await evaluate(parts);
    await logScan(parts, r, req.originalUrl, null);
    res.status(200).type('html').send(renderPage(present(r, parts)));
  } catch (e) {
    console.error('Error rendering verify page:', e.message);
    res.status(500).type('html').send('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;padding:24px"><h1>Temporarily unavailable</h1><p>Please try again in a moment.</p>');
  }
};

module.exports = { verifyApi, dispense, verifyPage, optionalAuth, limiter, evaluate, dbVerdict };

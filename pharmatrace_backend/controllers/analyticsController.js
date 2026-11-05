const pool = require('../config/db');
const { GASABO_SECTORS, sectorInfo } = require('../utils/sectors');

const TZ = 'Africa/Kigali'; // CAT, UTC+2. scan_events.scanned_at is a naive UTC timestamp.
const LOCAL = `((s.scanned_at AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}')`;
const TODAY = `date_trunc('day', NOW() AT TIME ZONE '${TZ}')`;

// A burst = this many scans of one batch in a single clock hour. Tune for your volumes.
const BURST_MIN = Math.max(2, parseInt(process.env.ANALYTICS_BURST_MIN, 10) || 10);
const HIGH_RATIO = 4;      // peak hour at least this many times the batch's typical hourly volume
const MULTI_WINDOW = `interval '24 hours'`;

const RANGES = {
  today: { days: 0, label: 'Today' },
  '7d': { days: 6, label: 'Last 7 days' },
  '30d': { days: 29, label: 'Last 30 days' },
};

const fmtDay = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }).format(d);
function dateLabel(key) {
  const now = new Date();
  if (key === 'today') return `${fmtDay(now)} · Today`;
  const from = new Date(now.getTime() - RANGES[key].days * 86400000);
  return `${fmtDay(from)} – ${fmtDay(now)} · ${RANGES[key].label}`;
}
const span = (min) => (min < 1 ? 'under a minute' : min < 60 ? `${Math.round(min)} minute${Math.round(min) === 1 ? '' : 's'}` : `${(min / 60).toFixed(1).replace(/\.0$/, '')} hours`);
const joinNames = (a) => (a.length <= 2 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

const getScanAnalytics = async (req, res) => {
  try {
    const key = RANGES[req.query.range] ? req.query.range : 'today';
    const START = `${TODAY} - interval '${RANGES[key].days} days'`;
    const IN_RANGE = `${LOCAL} >= ${START}`;

    const [totals, sectors, bursts, multi, flaggedScans] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(DISTINCT s.sector)::int AS sectors,
                         COUNT(*) FILTER (WHERE s.sector IS NULL)::int AS unknown
                  FROM scan_events s WHERE ${IN_RANGE}`),
      pool.query(`SELECT s.sector, COUNT(*)::int AS count FROM scan_events s
                  WHERE ${IN_RANGE} GROUP BY s.sector ORDER BY (s.sector IS NULL), count DESC, s.sector`),
      pool.query(
        `WITH h AS (
           SELECT s.batch_uuid, s.sector, date_trunc('hour', ${LOCAL}) AS hr, COUNT(*)::int AS n
           FROM scan_events s WHERE s.batch_uuid IS NOT NULL AND ${IN_RANGE} GROUP BY 1,2,3),
         peak AS (SELECT DISTINCT ON (batch_uuid) batch_uuid, sector, hr, n FROM h ORDER BY batch_uuid, n DESC, hr DESC)
         SELECT p.batch_uuid, p.sector, p.n, to_char(p.hr, 'HH24:MI') AS hour, to_char(p.hr, 'DD Mon') AS day,
                (SELECT COUNT(*) FROM scan_events s2
                  WHERE s2.batch_uuid = p.batch_uuid
                    AND ((s2.scanned_at AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}') >= p.hr - interval '7 days'
                    AND ((s2.scanned_at AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}') <  p.hr)::int AS prior
         FROM peak p WHERE p.n >= $1`, [BURST_MIN]),
      pool.query(
        `SELECT s.batch_uuid, s.serial, COUNT(*)::int AS n,
                array_agg(DISTINCT s.sector) FILTER (WHERE s.sector IS NOT NULL) AS names,
                EXTRACT(EPOCH FROM (MAX(s.scanned_at) - MIN(s.scanned_at))) / 60 AS span_min
         FROM scan_events s
         WHERE s.serial IS NOT NULL AND s.batch_uuid IS NOT NULL AND ${IN_RANGE}
         GROUP BY s.batch_uuid, s.serial
         HAVING COUNT(DISTINCT s.sector) FILTER (WHERE s.sector IS NOT NULL) >= 2
            AND MAX(s.scanned_at) - MIN(s.scanned_at) <= ${MULTI_WINDOW}`),
      pool.query(
        `SELECT s.batch_uuid, COUNT(*)::int AS n FROM scan_events s
         JOIN batches b ON b.id = s.batch_uuid
         WHERE b.status IN ('flagged','revoked') AND s.verdict IN ('flagged','revoked') AND ${IN_RANGE}
         GROUP BY s.batch_uuid`),
    ]);

    // One card per batch; the strongest signal leads and the others add detail.
    const byBatch = new Map();
    const add = (id, sig) => { if (!byBatch.has(id)) byBatch.set(id, []); byBatch.get(id).push(sig); };

    for (const r of bursts.rows) {
      const baseline = r.prior / 168;                       // average scans per hour over the previous 7 days
      const ratio = baseline >= 1 ? r.n / baseline : null;
      if (ratio !== null && ratio < 3) continue;            // busy batch, this hour is not unusual for it
      add(r.batch_uuid, {
        rank: 3, high: ratio !== null && ratio >= HIGH_RATIO, title: 'Unusually high scan count',
        detail: `${r.n} scans in 1 hour${r.sector ? ` at ${r.sector}` : ''} (${r.hour} CAT, ${r.day})${ratio ? ` — ${ratio.toFixed(1)}× the typical hourly volume` : ''}.`,
        score: r.n,
      });
    }
    const multiBy = new Map();
    for (const r of multi.rows) {
      const cur = multiBy.get(r.batch_uuid);
      if (!cur || r.names.length > cur.names.length || (r.names.length === cur.names.length && r.n > cur.n)) multiBy.set(r.batch_uuid, r);
    }
    for (const [id, r] of multiBy) {
      add(id, {
        rank: 2, high: false, title: 'Same pack scanned in multiple locations',
        detail: `${r.n} scans of pack ${r.serial} in ${joinNames(r.names)} within ${span(Number(r.span_min))}.`, score: r.n,
      });
    }
    for (const r of flaggedScans.rows) {
      add(r.batch_uuid, {
        rank: 1, high: true, title: 'Flagged batch is still being scanned',
        detail: `${r.n} scan${r.n === 1 ? '' : 's'} of a flagged or revoked batch in this period.`, score: r.n,
      });
    }

    let cards = [];
    if (byBatch.size) {
      const ids = [...byBatch.keys()];
      const { rows } = await pool.query(
        `SELECT b.id, b.batch_no, b.drug_name, b.status,
                EXISTS (SELECT 1 FROM flag_reports f WHERE f.batch_id = b.batch_no) AS has_report,
                EXISTS (SELECT 1 FROM flag_reports f WHERE f.batch_id = b.batch_no AND f.status <> 'closed') AS report_open
         FROM batches b WHERE b.id = ANY($1::uuid[])`, [ids]);
      cards = rows.map((b) => {
        const sigs = byBatch.get(b.id).sort((x, y) => y.rank - x.rank || y.score - x.score);
        const flagged = b.status === 'flagged' || b.status === 'revoked';
        const high = flagged || sigs.some((s) => s.high);
        return {
          batchId: b.id, batchNo: b.batch_no, drug: b.drug_name, batchStatus: b.status,
          risk: high ? 'high' : b.report_open ? 'under_review' : 'review',
          title: sigs[0].title,
          detail: `${sigs.map((s) => s.detail).join(' ')} ${flagged ? `Batch is already ${b.status}.` : 'Currently ' + b.status + '; evidence review required.'}`,
          link: b.has_report ? 'report' : 'batch',
          _s: high ? 1 : 0, _n: sigs[0].score,
        };
      }).sort((x, y) => y._s - x._s || y._n - x._n).slice(0, 6).map(({ _s, _n, ...c }) => c);
    }

    const t = totals.rows[0];
    res.json({
      range: key, dateLabel: dateLabel(key), generatedAt: new Date().toISOString(),
      totals: { total: t.total, sectors: t.sectors, unknown: t.unknown, suspiciousBatches: byBatch.size },
      sectors: sectors.rows, suspicious: cards, burstMin: BURST_MIN,
    });
  } catch (e) {
    console.error('getScanAnalytics:', e.message);
    res.status(500).json({ error: 'Could not load scan analytics' });
  }
};


// ───────────────────────── risk map ─────────────────────────
// One entry per Gasabo sector. Built only from scans made by signed-in pharmacists, whose sector is their pharmacy's
// sector. Patients scan anonymously and carry no location, and no scan stores coordinates, so nothing here can point
// at a person's home. The lat/lng are the middle of the sector (utils/sectors.js).
const CONCERN = ['flagged', 'expired', 'revoked'];   // shown red on the map

const getRiskMap = async (req, res) => {
  try {
    const key = req.query.range === 'all' ? 'all' : (RANGES[req.query.range] ? req.query.range : '30d');
    const IN_RANGE = key === 'all' ? 'TRUE' : `${LOCAL} >= ${TODAY} - interval '${RANGES[key].days} days'`;

    const [bySector, drugs, other] = await Promise.all([
      pool.query(`SELECT s.sector,
                         COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE s.verdict = 'authentic')::int AS authentic,
                         COUNT(*) FILTER (WHERE s.verdict = 'flagged')::int AS flagged,
                         COUNT(*) FILTER (WHERE s.verdict = 'expired')::int AS expired,
                         COUNT(*) FILTER (WHERE s.verdict = 'revoked')::int AS revoked,
                         COUNT(*) FILTER (WHERE s.verdict = 'duplicate')::int AS duplicate,
                         COUNT(*) FILTER (WHERE s.verdict = 'pending')::int AS pending,
                         COUNT(*) FILTER (WHERE s.verdict = 'not_found')::int AS not_found
                    FROM scan_events s WHERE s.sector IS NOT NULL AND ${IN_RANGE} GROUP BY s.sector`),
      pool.query(`SELECT s.sector, COALESCE(b.drug_name, 'Unknown product') AS drug, s.verdict, COUNT(*)::int AS n
                    FROM scan_events s LEFT JOIN batches b ON b.id = s.batch_uuid
                   WHERE s.sector IS NOT NULL AND s.batch_uuid IS NOT NULL AND ${IN_RANGE} GROUP BY 1, 2, 3`),
      pool.query(`SELECT COUNT(*)::int AS n FROM scan_events s WHERE s.sector IS NULL AND ${IN_RANGE}`),
    ]);

    const counts = new Map(bySector.rows.map((r) => [sectorInfo(r.sector)?.name, r]));
    const drugRows = new Map();
    for (const r of drugs.rows) {
      const name = sectorInfo(r.sector)?.name;
      if (!name) continue;
      if (!drugRows.has(name)) drugRows.set(name, []);
      drugRows.get(name).push(r);
    }

    const sectors = GASABO_SECTORS.map(({ name, lat, lng }) => {
      const c = counts.get(name);
      const rows = drugRows.get(name) ?? [];
      const concern = c ? c.flagged + c.expired + c.revoked : 0;
      const byDrug = new Map();
      for (const r of rows) byDrug.set(r.drug, (byDrug.get(r.drug) ?? 0) + r.n);
      return {
        sector: name, lat, lng,
        total: c?.total ?? 0,
        authentic: c?.authentic ?? 0, flagged: c?.flagged ?? 0, expired: c?.expired ?? 0, revoked: c?.revoked ?? 0,
        duplicate: c?.duplicate ?? 0, pending: c?.pending ?? 0, notFound: c?.not_found ?? 0,
        concern,
        status: !c ? 'none' : concern > 0 ? 'concern' : 'ok',
        topDrugs: [...byDrug].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([drug, scans]) => ({ drug, scans })),
        concernDrugs: rows.filter((r) => CONCERN.includes(r.verdict))
          .sort((a, b) => b.n - a.n).slice(0, 5).map((r) => ({ drug: r.drug, verdict: r.verdict, scans: r.n })),
      };
    });

    res.json({
      range: key,
      label: key === 'all' ? 'All time' : RANGES[key].label,
      sectors,
      totals: {
        scans: sectors.reduce((n, x) => n + x.total, 0),
        concern: sectors.reduce((n, x) => n + x.concern, 0),
        sectorsWithConcern: sectors.filter((x) => x.status === 'concern').length,
        withoutLocation: other.rows[0].n,   // anonymous patient scans: counted elsewhere, never placed on the map
      },
    });
  } catch (e) {
    console.error('getRiskMap:', e.message);
    res.status(500).json({ error: 'Could not load the risk map.' });
  }
};

module.exports = { getScanAnalytics, getRiskMap };

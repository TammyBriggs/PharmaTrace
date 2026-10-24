const pool = require('../config/db');

// Everything is reported in Kigali time (CAT, UTC+2). scan_events.scanned_at is a naive
// timestamp stored in UTC (Neon's default session time zone), so convert before comparing.
const LOCAL = `((s.scanned_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Kigali')`;
const TODAY = `date_trunc('day', NOW() AT TIME ZONE 'Africa/Kigali')`;

const VERDICT_KEYS = ['authentic', 'flagged', 'expired', 'pending', 'revoked', 'not_found'];

const where = (sector) => (sector ? ` in ${sector}` : '');
const ALERT_TEXT = {
  flagged: (a) => `Flagged batch scanned${where(a.sector)}`,
  expired: (a) => `Expired batch scanned${where(a.sector)}`,
  pending: (a) => `Unapproved batch scanned${where(a.sector)}`,
  revoked: (a) => `Revoked batch scanned${where(a.sector)}`,
};

const getOverview = async (req, res) => {
  try {
    const [mf, bt, inv, today, series, verdicts, cats, alerts, dups] = await Promise.all([
      pool.query(`SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                         COUNT(*) FILTER (WHERE status = 'active'
                           AND created_at >= date_trunc('month', NOW()))::int AS this_month
                  FROM manufacturers`),
      pool.query(`SELECT COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
                         COUNT(*) FILTER (WHERE status = 'pending')::int  AS pending,
                         COUNT(*) FILTER (WHERE status = 'flagged')::int  AS flagged
                  FROM batches`),
      pool.query(`SELECT COUNT(*)::int AS n FROM flag_reports WHERE status IN ('open','under_review')`),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(DISTINCT s.sector)::int AS sectors
                  FROM scan_events s WHERE ${LOCAL} >= ${TODAY}`),
      pool.query(`
        WITH today AS (SELECT (NOW() AT TIME ZONE 'Africa/Kigali')::date AS d)
        SELECT to_char(g::date, 'YYYY-MM-DD') AS date, COALESCE(c.n, 0)::int AS count
        FROM today,
             generate_series(today.d::timestamp - interval '29 days', today.d::timestamp, interval '1 day') g
        LEFT JOIN (
          SELECT ${LOCAL}::date AS day, COUNT(*) AS n
          FROM scan_events s WHERE s.scanned_at >= NOW() - interval '31 days' GROUP BY 1
        ) c ON c.day = g::date
        ORDER BY g`),
      pool.query(`SELECT verdict, COUNT(*)::int AS n FROM scan_events
                  WHERE scanned_at >= NOW() - interval '30 days' GROUP BY verdict`),
      pool.query(`SELECT b.category, COUNT(*)::int AS n
                  FROM scan_events s JOIN batches b ON b.id = s.batch_uuid
                  WHERE ${LOCAL} >= ${TODAY} GROUP BY b.category ORDER BY n DESC`),
      pool.query(`SELECT s.verdict, s.sector, b.batch_no, b.drug_name,
                         s.scanned_at AT TIME ZONE 'UTC' AS at,
                         to_char(${LOCAL}, 'HH24:MI') AS time
                  FROM scan_events s LEFT JOIN batches b ON b.id = s.batch_uuid
                  WHERE s.verdict IN ('flagged','expired','pending','revoked')
                    AND s.scanned_at >= NOW() - interval '7 days'
                  ORDER BY s.scanned_at DESC LIMIT 5`),
      // Same serial seen in 2+ sectors within 24h is the cloned-packaging signal.
      pool.query(`SELECT b.batch_no, b.drug_name, s.serial,
                         COUNT(DISTINCT s.sector)::int AS sectors,
                         MAX(s.scanned_at) AT TIME ZONE 'UTC' AS at,
                         to_char(((MAX(s.scanned_at) AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Kigali'), 'HH24:MI') AS time
                  FROM scan_events s JOIN batches b ON b.id = s.batch_uuid
                  WHERE s.serial IS NOT NULL AND s.sector IS NOT NULL
                    AND s.scanned_at >= NOW() - interval '24 hours'
                  GROUP BY b.batch_no, b.drug_name, s.serial
                  HAVING COUNT(DISTINCT s.sector) >= 2
                  ORDER BY MAX(s.scanned_at) DESC LIMIT 5`),
    ]);

    const counts = Object.fromEntries(VERDICT_KEYS.map((k) => [k, 0]));
    let total = 0;
    for (const r of verdicts.rows) {
      total += r.n;
      if (r.verdict in counts) counts[r.verdict] += r.n;
    }

    const points = series.rows;
    const merged = [
      ...dups.rows.map((d) => ({
        kind: 'duplicate', batchNo: d.batch_no, drug: d.drug_name, time: d.time, at: d.at,
        detail: `Serial ${d.serial} scanned in ${d.sectors} sectors within 24h`,
      })),
      ...alerts.rows.map((a) => ({
        kind: a.verdict, batchNo: a.batch_no, drug: a.drug_name, time: a.time, at: a.at,
        detail: ALERT_TEXT[a.verdict](a),
      })),
    ].sort((x, y) => new Date(y.at) - new Date(x.at)).slice(0, 5);

    res.status(200).json({
      generatedAt: new Date().toISOString(),
      kpis: {
        manufacturers: { active: mf.rows[0].active, thisMonth: mf.rows[0].this_month },
        batches: bt.rows[0],
        openInvestigations: inv.rows[0].n,
        scansToday: today.rows[0],
      },
      scansOverTime: {
        total: points.reduce((s, p) => s + p.count, 0),
        points,
      },
      verdicts: { ...counts, total },
      categories: cats.rows.map((c) => ({ category: c.category, count: c.n })),
      alerts: merged,
    });
  } catch (error) {
    console.error('Error building overview:', error.message);
    res.status(500).json({ error: 'Server error while loading the overview' });
  }
};

module.exports = { getOverview };

const pool = require('../config/db');

const WINDOW_DAYS = 30;
const LIMIT = 30;
const ISO = (col) => `to_char(${col}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;   // naive UTC timestamp -> ISO string

// Deliberately NOT included: individual scans, pack dispenses, or anything a user did themselves.
// Regulators hear about work that needs them; manufacturers hear about decisions on their own batches.
const REGULATOR_SQL = `
  SELECT 'submitted' AS kind, be.id::text AS id, be.created_at AS at,
         b.batch_no AS a, b.drug_name AS b, m.name AS c, NULL AS d
  FROM batch_events be JOIN batches b ON b.id = be.batch_uuid JOIN manufacturers m ON m.id = b.manufacturer_id
  WHERE be.event = 'submitted' AND be.created_at >= (NOW() AT TIME ZONE 'UTC') - interval '${WINDOW_DAYS} days'
  UNION ALL
  SELECT 'report', f.id::text, f.reported_at, f.batch_id, f.reason, f.location, NULL
  FROM flag_reports f
  WHERE f.reported_at >= (NOW() AT TIME ZONE 'UTC') - interval '${WINDOW_DAYS} days'`;

const MANUFACTURER_SQL = `
  SELECT be.event AS kind, be.id::text AS id, be.created_at AS at,
         b.batch_no AS a, b.drug_name AS b, be.reason AS c, NULL AS d
  FROM batch_events be JOIN batches b ON b.id = be.batch_uuid
  WHERE b.manufacturer_id = $1
    AND be.event IN ('approved','flagged','flag_resolved','revoked','reinstated')
    AND be.created_at >= (NOW() AT TIME ZONE 'UTC') - interval '${WINDOW_DAYS} days'
  UNION ALL
  SELECT a.action, a.id::text, (to_timestamp(a.ts_ms / 1000.0) AT TIME ZONE 'UTC'), NULL, NULL, NULL, NULL
  FROM audit_log a
  WHERE a.entity_type = 'manufacturer' AND a.entity_id = $1::uuid::text AND a.action IN ('manufacturer.register','manufacturer.revoke')
    AND to_timestamp(a.ts_ms / 1000.0) >= NOW() - interval '${WINDOW_DAYS} days'`;

const reasonText = (r) => (r ? `: ${r}` : '.');
function present(r) {
  switch (r.kind) {
    case 'submitted': return { title: 'Batch submitted for review', body: `${r.c} submitted ${r.a} · ${r.b}.` };
    case 'report': return { title: 'New flag report', body: `Pharmacist report on ${r.a}${r.c ? ` in ${r.c}` : ''}: ${r.b}` };
    case 'approved': return { title: 'Batch approved', body: `${r.a} · ${r.b} was approved and can now be verified by the public.` };
    case 'flagged': return { title: 'Batch flagged', body: `${r.a} was flagged by the regulator${reasonText(r.c)}` };
    case 'flag_resolved': return { title: 'Flag cleared', body: `The flag on ${r.a} was resolved.` };
    case 'revoked': return { title: 'Batch revoked', body: `${r.a} was revoked by the regulator${reasonText(r.c)}` };
    case 'reinstated': return { title: 'Batch reinstated', body: `${r.a} was reinstated.` };
    case 'manufacturer.register': return { title: 'Account approved', body: 'Your manufacturer account is registered and active.' };
    case 'manufacturer.revoke': return { title: 'Account revoked', body: 'Your manufacturer account was revoked. You can no longer submit batches.' };
    default: return null;
  }
}

const getNotifications = async (req, res) => {
  try {
    const me = (await pool.query(
      `SELECT role, manufacturer_id, COALESCE(notifications_seen_at, created_at) AS seen,
              to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS now_iso
       FROM users WHERE id = $1`, [req.user.id])).rows[0];
    if (!me) return res.status(401).json({ error: 'Account not found' });

    const isMfr = req.user.role === 'manufacturer';
    if (isMfr && !me.manufacturer_id) return res.json({ unread: 0, generatedAt: me.now_iso, items: [] });

    const { rows } = await pool.query(
      `SELECT x.kind, x.id, ${ISO('x.at')} AS at, x.at > $${isMfr ? 2 : 1} AS is_new, x.a, x.b, x.c
       FROM (${isMfr ? MANUFACTURER_SQL : REGULATOR_SQL}) x
       ORDER BY x.at DESC LIMIT ${LIMIT}`,
      isMfr ? [me.manufacturer_id, me.seen] : [me.seen]);

    const items = rows.map((r) => ({ ...present(r), id: `${r.kind}:${r.id}`, kind: r.kind, at: r.at, isNew: r.is_new })).filter((i) => i.title);
    res.json({ unread: items.filter((i) => i.isNew).length, generatedAt: me.now_iso, items });
  } catch (e) {
    console.error('getNotifications:', e.message);
    res.status(500).json({ error: 'Could not load notifications' });
  }
};

// Called when the panel opens. The client sends the generatedAt it was shown, so anything that
// arrived between loading and opening still counts as unread.
const markSeen = async (req, res) => {
  try {
    const at = new Date(String((req.body && req.body.seenAt) || ''));
    if (Number.isNaN(at.getTime())) return res.status(400).json({ error: 'seenAt must be a timestamp' });
    await pool.query(
      `UPDATE users SET notifications_seen_at = GREATEST(COALESCE(notifications_seen_at, 'epoch'::timestamp),
                                                        LEAST($2::timestamp, NOW() AT TIME ZONE 'UTC'))
       WHERE id = $1`, [req.user.id, at.toISOString().replace('Z', '')]);
    res.json({ ok: true });
  } catch (e) {
    console.error('markSeen:', e.message);
    res.status(500).json({ error: 'Could not update notifications' });
  }
};

module.exports = { getNotifications, markSeen };

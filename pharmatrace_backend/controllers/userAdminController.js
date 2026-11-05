const pool = require('../config/db');
const { createAccount, resetAccount } = require('../utils/accounts');
const { normalizeSector } = require('../utils/sectors');
const { isEmail } = require('../utils/password');
const { recordAudit } = require('../utils/audit');

const PAGE_SIZE = 8;
const PHONE = /^\+?[0-9 ]{9,15}$/;

const toApi = (u) => ({
  id: u.id, name: u.name, contact: u.contact, sector: u.sector,
  active: u.is_active, mustChangePassword: u.must_change_password,
  lastLogin: u.last_login ? `${u.last_login.toISOString().slice(0, 19)}Z` : null,
});

const COLS = 'id, name, contact, sector, is_active, must_change_password, last_login';
const likeOf = (s) => (s ? `%${s.replace(/[\\%_]/g, '\\$&')}%` : null);

/** GET /api/users?search=&status=active|inactive&page= — pharmacist accounts. */
const listPharmacists = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const like = likeOf(String(req.query.search || '').trim().slice(0, 80));
    const active = { active: true, inactive: false }[req.query.status] ?? null;
    const [rows, counts] = await Promise.all([
      pool.query(
        `SELECT ${COLS}, COUNT(*) OVER()::int AS total FROM users
          WHERE role = 'pharmacist'
            AND ($1::text IS NULL OR name ILIKE $1 OR contact ILIKE $1 OR sector ILIKE $1)
            AND ($2::boolean IS NULL OR is_active = $2)
          ORDER BY created_at DESC NULLS LAST LIMIT $3 OFFSET $4`,
        [like, active, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
      pool.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE is_active)::int AS active,
                         COUNT(*) FILTER (WHERE NOT is_active)::int AS inactive,
                         COUNT(*) FILTER (WHERE must_change_password)::int AS awaiting
                    FROM users WHERE role = 'pharmacist'`),
    ]);
    res.json({ items: rows.rows.map(toApi), total: rows.rows[0]?.total ?? 0, page, pageSize: PAGE_SIZE, counts: counts.rows[0] });
  } catch (e) {
    console.error('listPharmacists:', e.message);
    res.status(500).json({ error: 'Could not load pharmacist accounts.' });
  }
};

/** POST /api/users — create a pharmacist login. Returns the temporary password once. */
const createPharmacist = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const contact = String(req.body.contact || '').trim().toLowerCase();
    const sector = normalizeSector(req.body.sector);
    if (name.length < 2 || name.length > 120) return res.status(400).json({ error: 'Enter the pharmacist’s name (2–120 characters).' });
    if (!isEmail(contact) && !PHONE.test(contact)) return res.status(400).json({ error: 'Enter a valid email address or phone number.' });
    if (!sector) return res.status(400).json({ error: 'Choose one of the 15 Gasabo sectors.' });
    const dup = await pool.query('SELECT 1 FROM users WHERE lower(contact) = $1', [contact]);
    if (dup.rowCount) return res.status(409).json({ error: 'An account with that email or phone already exists.' });

    const out = await createAccount({ name, role: 'pharmacist', contact, sector, actorId: req.user.id });
    res.status(201).json({ user: toApi({ ...out.user, is_active: true, must_change_password: true }), temporaryPassword: out.temporaryPassword, emailSent: out.emailSent });
  } catch (e) {
    console.error('createPharmacist:', e.message);
    res.status(500).json({ error: 'Could not create the account.' });
  }
};

const ownPharmacist = async (id) => (await pool.query(`SELECT ${COLS} FROM users WHERE id = $1 AND role = 'pharmacist'`, [id])).rows[0];

/** POST /api/users/:id/reset-password — new temporary password, shown once. */
const resetPharmacist = async (req, res) => {
  try {
    if (!(await ownPharmacist(req.params.id))) return res.status(404).json({ error: 'Pharmacist not found.' });
    const out = await resetAccount({ userId: req.params.id, actorId: req.user.id });
    res.json({ user: toApi({ ...out.user, is_active: true, must_change_password: true }), temporaryPassword: out.temporaryPassword, emailSent: out.emailSent });
  } catch (e) {
    console.error('resetPharmacist:', e.message);
    res.status(500).json({ error: 'Could not reset the password.' });
  }
};

/** PATCH /api/users/:id/active { active } — deactivate or reactivate. History stays; the account just cannot sign in. */
const setPharmacistActive = async (req, res) => {
  try {
    if (typeof req.body.active !== 'boolean') return res.status(400).json({ error: 'Send { "active": true or false }.' });
    const u = await ownPharmacist(req.params.id);
    if (!u) return res.status(404).json({ error: 'Pharmacist not found.' });
    const { rows } = await pool.query(`UPDATE users SET is_active = $2 WHERE id = $1 RETURNING ${COLS}`, [u.id, req.body.active]);
    try {
      await recordAudit({ actor_id: req.user.id, action: req.body.active ? 'account.activate' : 'account.deactivate', entity_type: 'user', entity_id: u.id, details: { name: u.name, role: 'pharmacist' } });
    } catch (e) { console.error('audit:', e.message); }
    res.json({ user: toApi(rows[0]) });
  } catch (e) {
    console.error('setPharmacistActive:', e.message);
    res.status(500).json({ error: 'Could not update the account.' });
  }
};

module.exports = { listPharmacists, createPharmacist, resetPharmacist, setPharmacistActive };

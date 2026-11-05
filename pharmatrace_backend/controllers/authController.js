
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generatePresignedUrl } = require('../config/storage');
const { normalizeSector } = require('../utils/sectors');
const { passwordProblem, generateResetCode, hashResetCode, sameHash, isEmail } = require('../utils/password');
const { sendMail, resetText } = require('../utils/mailer');

const BCRYPT_ROUNDS = 10;
const RESET_MINUTES = 15;
const RESET_MAX_ATTEMPTS = 5;
const RESET_COOLDOWN_SECONDS = 60;
// Timestamp columns are naive UTC, so every write and comparison below says UTC explicitly instead of trusting the session time zone.
const UTC_NOW = "(now() AT TIME ZONE 'UTC')";

// A token issued while the password is still temporary carries mcp: true. The auth middleware then refuses
// everything except the change-password call, so skipping the forced change in the UI gets a client nowhere.
const signToken = (user, mustChange) => jwt.sign(
  { id: user.id, role: user.role, name: user.name, ...(mustChange ? { mcp: true } : {}) },
  process.env.JWT_SECRET,
  { expiresIn: '7d' },
);

const publicUser = async (user) => ({
  id: user.id,
  name: user.name,
  role: user.role,
  contact: user.contact,
  sector: user.sector,
  wallet_address: user.wallet_address,
  must_change_password: user.must_change_password,
  profile_pic_url: user.profile_pic_key ? await generatePresignedUrl(user.profile_pic_key) : null,
});


const makeLogin = (allowedRoles) => async (req, res) => {
  try {
    const contact = String(req.body.contact ?? '').trim();
    const { password } = req.body;

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE lower(contact) = lower($1)',
      [contact],
    );

    const user = rows[0];

    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    if (user.is_active === false) {
      return res.status(403).json({
        error: 'This account has been deactivated',
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: 'This account cannot sign in here',
      });
    }

    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id],
    );

    const token = signToken(user, user.must_change_password);

    res.status(200).json({
      message: 'Login successful',
      token,
      user: await publicUser(user),
    });
  } catch (error) {
    console.error('Error logging in:', error.message);

    res.status(500).json({
      error: 'Server error during login',
    });
  }
};

// Mobile app: pharmacists only.
const login = makeLogin(['pharmacist']);

// Web dashboard: regulators, manufacturers, and super admins.
const dashboardLogin = makeLogin([
  'regulator',
  'manufacturer',
  'super_admin',
]);

const updateProfile = async (req, res) => {
  try {
    // The authentication middleware must set req.user.
    const userId = req.user.id;
    const { name, sector } = req.body;

    // multer-s3 provides the uploaded object's key.
    const profilePicKey = req.file ? req.file.key : undefined;

    const updates = [];
    const params = [];

    if (name !== undefined) {
      params.push(name);
      updates.push(`name = $${params.length}`);
    }

    if (sector !== undefined) {
      // Only the 15 Gasabo sectors are accepted; an empty value clears it.
      const clean = sector === null || String(sector).trim() === '' ? null : normalizeSector(sector);
      if (sector !== null && String(sector).trim() !== '' && !clean) {
        return res.status(400).json({ error: 'Choose one of the 15 Gasabo sectors.' });
      }
      params.push(clean);
      updates.push(`sector = $${params.length}`);
    }

    if (profilePicKey !== undefined) {
      params.push(profilePicKey);
      updates.push(`profile_pic_key = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No profile changes were provided',
      });
    }

    params.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, name, role, contact, sector, profile_pic_key
    `;

    const updatedUserResult = await pool.query(query, params);

    if (updatedUserResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    const user = updatedUserResult.rows[0];

    // Generate a usable URL for the updated profile picture.
    const profilePicUrl = user.profile_pic_key
      ? await generatePresignedUrl(user.profile_pic_key)
      : null;

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        contact: user.contact,
        sector: user.sector,
        profile_pic_key: user.profile_pic_key,
        profile_pic_url: profilePicUrl,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error.message);

    res.status(500).json({
      error: 'Server error during profile update',
    });
  }
};

// POST /api/auth/change-password  { currentPassword, newPassword }  (signed in)
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (!user || user.is_active === false) return res.status(404).json({ error: 'Account not found.' });

    if (!(await bcrypt.compare(String(currentPassword ?? ''), user.password_hash))) {
      return res.status(400).json({ error: 'Your current password is not correct.' });
    }
    const problem = passwordProblem(newPassword, user.contact);
    if (problem) return res.status(400).json({ error: problem });
    if (await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Choose a password that is different from the current one.' });
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const upd = await pool.query(
      `UPDATE users SET password_hash = $2, must_change_password = false, password_changed_at = ${UTC_NOW}
        WHERE id = $1 RETURNING *`,
      [user.id, hash],
    );
    res.status(200).json({
      message: 'Password changed.',
      token: signToken(upd.rows[0], false), // replaces the restricted token from the first sign-in
      user: await publicUser(upd.rows[0]),
    });
  } catch (error) {
    console.error('Error changing password:', error.message);
    res.status(500).json({ error: 'Server error while changing the password.' });
  }
};

const GENERIC_FORGOT = 'If that email belongs to an account, a reset code has been sent. It expires in 15 minutes.';

// POST /api/auth/forgot-password  { contact }  — always answers the same, so it cannot be used to find accounts.
const forgotPassword = async (req, res) => {
  try {
    const contact = String(req.body.contact ?? '').trim();
    if (isEmail(contact)) {
      const { rows } = await pool.query(
        'SELECT id, name, contact FROM users WHERE lower(contact) = lower($1) AND is_active = true', [contact]);
      const user = rows[0];
      if (user) {
        const recent = await pool.query(
          `SELECT 1 FROM password_resets WHERE user_id = $1 AND created_at > ${UTC_NOW} - make_interval(secs => $2)`,
          [user.id, RESET_COOLDOWN_SECONDS]);
        if (!recent.rowCount) {
          const code = generateResetCode();
          await pool.query(`UPDATE password_resets SET used_at = ${UTC_NOW} WHERE user_id = $1 AND used_at IS NULL`, [user.id]);
          await pool.query(
            `INSERT INTO password_resets (user_id, token_hash, created_at, expires_at)
             VALUES ($1, $2, ${UTC_NOW}, ${UTC_NOW} + make_interval(mins => $3))`,
            [user.id, hashResetCode(user.id, code), RESET_MINUTES]);
          const sent = await sendMail({ to: user.contact, subject: 'Your PharmaTrace reset code', text: resetText({ name: user.name, code }) });
          if (!sent.sent) console.warn(`Reset code for ${user.contact} was not emailed (${sent.reason}). Ask a regulator to reset the password instead.`);
        }
      }
    }
    res.status(200).json({ message: GENERIC_FORGOT });
  } catch (error) {
    console.error('Error starting password reset:', error.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
};

const BAD_CODE = 'That code is not valid or has expired. Ask for a new one.';

// POST /api/auth/reset-password  { contact, code, newPassword }
const resetPassword = async (req, res) => {
  try {
    const contact = String(req.body.contact ?? '').trim();
    const code = String(req.body.code ?? '').trim();
    const { newPassword } = req.body;

    const problem = passwordProblem(newPassword, contact);
    if (problem) return res.status(400).json({ error: problem });
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: BAD_CODE });

    const u = (await pool.query(
      'SELECT id FROM users WHERE lower(contact) = lower($1) AND is_active = true', [contact])).rows[0];
    if (!u) return res.status(400).json({ error: BAD_CODE });

    const r = (await pool.query(
      `SELECT id, token_hash, attempts FROM password_resets
        WHERE user_id = $1 AND used_at IS NULL AND expires_at > ${UTC_NOW}
        ORDER BY created_at DESC LIMIT 1`, [u.id])).rows[0];
    if (!r) return res.status(400).json({ error: BAD_CODE });

    if (r.attempts >= RESET_MAX_ATTEMPTS) {
      await pool.query(`UPDATE password_resets SET used_at = ${UTC_NOW} WHERE id = $1`, [r.id]);
      return res.status(400).json({ error: BAD_CODE });
    }
    if (!sameHash(r.token_hash, hashResetCode(u.id, code))) {
      await pool.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1', [r.id]);
      return res.status(400).json({ error: BAD_CODE });
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query(
      `UPDATE users SET password_hash = $2, must_change_password = false, password_changed_at = ${UTC_NOW} WHERE id = $1`,
      [u.id, hash]);
    await pool.query(`UPDATE password_resets SET used_at = ${UTC_NOW} WHERE user_id = $1 AND used_at IS NULL`, [u.id]);
    res.status(200).json({ message: 'Password updated. You can sign in now.' });
  } catch (error) {
    console.error('Error resetting password:', error.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
};

module.exports = {
  login,
  dashboardLogin,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
};

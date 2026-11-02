// Applies the SQL files in migrations/ in order (001, 002, ...) to the database in DATABASE_URL.
// Safe to run again: applied files are recorded in the schema_migrations table and skipped.
//   cd pharmatrace_backend && node scripts/migrate.js
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

(async () => {
  const dir = path.join(__dirname, '..', 'migrations');
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamp NOT NULL DEFAULT now())');
  const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  // An existing database (created before this runner) already has the tables: record 001 to 007 instead of re-running.
  const existing = (await pool.query(`SELECT to_regclass('public.users') AS t`)).rows[0].t;
  if (existing && done.size === 0) {
    for (const f of files) await pool.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [f]);
    console.log('Existing database detected: marked', files.length, 'migrations as applied. Nothing was changed.');
    return pool.end();
  }

  for (const f of files) {
    if (done.has(f)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log('applied', f);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`Migration ${f} failed: ${e.message}`);
      process.exit(1);
    } finally { client.release(); }
  }
  console.log('Database is up to date.');
  await pool.end();
})();

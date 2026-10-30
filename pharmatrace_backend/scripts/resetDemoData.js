// Run after restarting `npx hardhat node` and redeploying the contract:
//   cd pharmatrace_backend && node scripts/resetDemoData.js --yes
// Clears everything that mirrors the chain, so the database matches the fresh chain again.
// Users (including the super admin and pharmacists) are kept. The audit log is kept too:
// it is append-only by design, so the reset is recorded in it instead of erasing history.
//   --include-reports   also delete pharmacist flag reports
const pool = require('../config/db');
const { recordAudit } = require('../utils/audit');

async function resetDemoData({ includeReports = false } = {}) {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run with NODE_ENV=production.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const removed = {};
    // Children first, because of foreign keys.
    for (const t of ['scan_events', 'serials', 'batches']) {
      removed[t] = (await client.query(`DELETE FROM ${t}`)).rowCount;
    }
    await client.query('UPDATE users SET manufacturer_id = NULL WHERE manufacturer_id IS NOT NULL');
    removed.manufacturers = (await client.query('DELETE FROM manufacturers')).rowCount;
    if (includeReports) removed.flag_reports = (await client.query('DELETE FROM flag_reports')).rowCount;
    await recordAudit({ action: 'system.demo_reset', entity_type: 'system', details: { removed } }, client);
    await client.query('COMMIT');
    return removed;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { resetDemoData };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args.includes('--yes')) {
    console.log('This deletes all manufacturers, batches, serials and scan events from the database.');
    console.log('Run again with --yes to confirm (add --include-reports to also clear flag reports).');
    process.exit(1);
  }
  resetDemoData({ includeReports: args.includes('--include-reports') })
    .then((removed) => {
      console.log('Demo data reset. Removed:', removed);
      console.log('Next: make sure the contract was redeployed (npx hardhat run scripts/deploy.js --network localhost).');
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((e) => { console.error('Reset failed:', e.message); process.exit(1); });
}

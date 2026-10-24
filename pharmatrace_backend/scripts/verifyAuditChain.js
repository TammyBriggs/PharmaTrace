// Run from pharmatrace_backend/:  node scripts/verifyAuditChain.js
const { verifyAuditChain } = require('../utils/audit');
const pool = require('../config/db');

verifyAuditChain()
  .then((r) => { console.log(r); return pool.end(); })
  .then(() => process.exit(0))
  .catch((e) => { console.error(e.message); process.exit(1); });

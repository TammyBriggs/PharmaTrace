const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { listAudit, verifyChain } = require('../controllers/auditController');

// Regulator only (super_admin passes every role check). Read-only: nothing here can change the log.
router.get('/', verifyToken, requireRole('regulator'), listAudit);
router.get('/verify', verifyToken, requireRole('regulator'), verifyChain);

module.exports = router;

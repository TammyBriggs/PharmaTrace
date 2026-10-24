const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { getOverview } = require('../controllers/overviewController');

// Regulator view (super_admin passes every role check).
router.get('/', verifyToken, requireRole('regulator'), getOverview);

module.exports = router;

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { getOverview } = require('../controllers/overviewController');
const { getScanAnalytics } = require('../controllers/analyticsController');

// Regulator views (super_admin passes every role check).
router.get('/', verifyToken, requireRole('regulator'), getOverview);
router.get('/analytics', verifyToken, requireRole('regulator'), getScanAnalytics);   // GET /api/overview/analytics?range=today|7d|30d

module.exports = router;

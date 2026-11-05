const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { getOverview } = require('../controllers/overviewController');
const { getScanAnalytics, getRiskMap } = require('../controllers/analyticsController');
const { getMyOverview } = require('../controllers/manufacturerInsightsController');

// Regulator views (super_admin passes every role check).
router.get('/', verifyToken, requireRole('regulator'), getOverview);
router.get('/analytics', verifyToken, requireRole('regulator'), getScanAnalytics);   // GET /api/overview/analytics?range=today|7d|30d
router.get('/map', verifyToken, requireRole('regulator'), getRiskMap);               // GET /api/overview/map?range=today|7d|30d|all
// A manufacturer's own overview (super_admin has no manufacturer, so it gets a 404 message instead of data).
router.get('/manufacturer', verifyToken, requireRole('manufacturer'), getMyOverview);

module.exports = router;

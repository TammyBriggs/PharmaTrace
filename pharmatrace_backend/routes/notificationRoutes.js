const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { getNotifications, markSeen } = require('../controllers/notificationController');

// Dashboard users only (the pharmacist app does not use this).
router.use(verifyToken, requireRole('regulator', 'manufacturer'));
router.get('/', getNotifications);
router.post('/seen', markSeen);

module.exports = router;

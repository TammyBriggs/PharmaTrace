const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { getChainConfig } = require('../controllers/chainController');

router.get('/config', verifyToken, requireRole('regulator', 'manufacturer'), getChainConfig);

module.exports = router;

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { search } = require('../controllers/searchController');

router.get('/', verifyToken, requireRole('regulator', 'manufacturer'), search);   // GET /api/search?q=

module.exports = router;

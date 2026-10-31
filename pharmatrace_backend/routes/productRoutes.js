const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { listProducts } = require('../controllers/productController');

router.get('/', verifyToken, requireRole('regulator', 'manufacturer'), listProducts); // super_admin passes
module.exports = router;

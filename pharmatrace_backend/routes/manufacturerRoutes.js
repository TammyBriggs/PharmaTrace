const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { listManufacturers, createManufacturer, confirmManufacturer } = require('../controllers/manufacturerController');

router.use(verifyToken, requireRole('regulator')); // super_admin passes
router.get('/', listManufacturers);
router.post('/', createManufacturer);
router.post('/:id/confirm', confirmManufacturer);

module.exports = router;

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { dispense } = require('../controllers/verifyController');
const { listSerials } = require('../controllers/serialController');

router.use(verifyToken);
router.post('/dispense', requireRole('pharmacist'), dispense);                       // super_admin passes for testing
router.get('/batch/:id', requireRole('regulator', 'manufacturer'), listSerials);
module.exports = router;

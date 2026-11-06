const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { dispense } = require('../controllers/verifyController');
const { listSerials, getSerialProof } = require('../controllers/serialController');

router.use(verifyToken);
router.post('/dispense', requireRole('pharmacist'), dispense);                       // super_admin passes for testing
router.get('/batch/:id', requireRole('regulator', 'manufacturer'), listSerials);
router.get('/batch/:id/proof', requireRole('regulator', 'manufacturer'), getSerialProof);
module.exports = router;

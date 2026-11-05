const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { listPharmacists, createPharmacist, resetPharmacist, setPharmacistActive } = require('../controllers/userAdminController');

router.use(verifyToken, requireRole('regulator')); // super_admin passes
router.get('/', listPharmacists);
router.post('/', createPharmacist);
router.post('/:id/reset-password', resetPharmacist);
router.patch('/:id/active', setPharmacistActive);

module.exports = router;

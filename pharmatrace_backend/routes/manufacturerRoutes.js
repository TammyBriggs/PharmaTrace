const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { listManufacturers, createManufacturer, confirmManufacturer, issueManufacturerLogin } = require('../controllers/manufacturerController');
const { getManufacturerProfile } = require('../controllers/manufacturerInsightsController');

router.use(verifyToken, requireRole('regulator')); // super_admin passes
router.get('/', listManufacturers);
router.post('/', createManufacturer);
router.get('/:id/profile', getManufacturerProfile);     // new: one manufacturer's profile and numbers
router.post('/:id/confirm', confirmManufacturer);
router.post('/:id/login', issueManufacturerLogin);        // create the dashboard login, or issue a new temporary password

module.exports = router;

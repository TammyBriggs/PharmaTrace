const express = require('express');
const router = express.Router();
const {
  submitReport, getReports, listReviewQueue, getReviewDetail, setReviewStatus,
} = require('../controllers/reportController');
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { upload } = require('../config/storage');

router.use(verifyToken);

// Pharmacist (mobile app)
router.post('/', upload.single('image'), submitReport);
router.get('/', getReports);

// Regulator review queue (super_admin passes the role check). Declared before any /:id route.
router.get('/review', requireRole('regulator'), listReviewQueue);
router.get('/review/:id', requireRole('regulator'), getReviewDetail);
router.post('/review/:id/status', requireRole('regulator'), setReviewStatus);

module.exports = router;

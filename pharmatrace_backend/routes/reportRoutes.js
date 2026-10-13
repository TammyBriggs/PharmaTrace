const express = require('express');
const router = express.Router();
const { submitReport, getReports } = require('../controllers/reportController');
const verifyToken = require('../middleware/authMiddleware');
const upload = require('../config/storage');

// Apply the verifyToken middleware to all routes in this file
router.use(verifyToken);

// The 'image' string must match the form-data key sent from Flutter
router.post('/', upload.single('image'), submitReport);
router.get('/', getReports);

module.exports = router;

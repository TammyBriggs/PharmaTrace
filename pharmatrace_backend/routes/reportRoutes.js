const express = require('express');
const router = express.Router();
const { submitReport, getReports } = require('../controllers/reportController');
const verifyToken = require('../middleware/authMiddleware');
const { upload } = require('../config/storage'); // <-- Destructure { upload }

router.use(verifyToken);

router.post('/', upload.single('image'), submitReport);
router.get('/', getReports);

module.exports = router;
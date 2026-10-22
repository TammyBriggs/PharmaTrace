const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');
const { upload } = require('../config/storage');

const requireRole = require('../middleware/requireRole');

const {
  register,
  login,
  updateProfile,
} = require('../controllers/authController');

router.post('/login', login);
router.post('/dashboard-login', dashboardLogin);
router.post('/register', verifyToken, requireRole('regulator'), register); // provisioning, no longer public

// Update the authenticated user's profile, including an optional profile picture.
router.put(
  '/profile',
  verifyToken,
  upload.single('profile_pic'),
  updateProfile,
);

module.exports = router;
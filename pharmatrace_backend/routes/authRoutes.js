const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');
const { upload } = require('../config/storage');

const requireRole = require('../middleware/requireRole');

const {
  login,
  dashboardLogin,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { createPharmacist } = require('../controllers/userAdminController');
const { loginLimiter, forgotLimiter, resetLimiter } = require('../middleware/rateLimit');

router.post('/login', loginLimiter, login);
router.post('/dashboard-login', loginLimiter, dashboardLogin);
router.post('/register', verifyToken, requireRole('regulator'), createPharmacist); // regulator provisions a pharmacist (same as POST /api/users)
router.post('/change-password', verifyToken, changePassword);
router.post('/forgot-password', forgotLimiter, forgotPassword);
router.post('/reset-password', resetLimiter, resetPassword);

// Update the authenticated user's profile, including an optional profile picture.
router.put(
  '/profile',
  verifyToken,
  upload.single('profile_pic'),
  updateProfile,
);

module.exports = router;
const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');
const { upload } = require('../config/storage');

const {
  register,
  login,
  updateProfile,
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);

// Update the authenticated user's profile, including an optional profile picture.
router.put(
  '/profile',
  verifyToken,
  upload.single('profile_pic'),
  updateProfile,
);

module.exports = router;
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generatePresignedUrl } = require('../config/storage');

const register = async (req, res) => {
  try {
    const { name, role, wallet_address, contact, password } = req.body;

    // Check if user already exists.
    const userExists = await pool.query(
      'SELECT * FROM users WHERE contact = $1',
      [contact],
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        error: 'User with this contact already exists',
      });
    }

    // Hash password.
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user into PostgreSQL.
    const newUser = await pool.query(
      `INSERT INTO users
        (name, role, wallet_address, contact, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, role, contact`,
      [name, role, wallet_address, contact, passwordHash],
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser.rows[0],
    });
  } catch (error) {
    console.error('Error registering user:', error.message);

    res.status(500).json({
      error: 'Server error during registration',
    });
  }
};

const login = async (req, res) => {
  try {
    const { contact, password } = req.body;

    // Find user.
    const userResult = await pool.query(
      'SELECT * FROM users WHERE contact = $1',
      [contact],
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    const user = userResult.rows[0];

    // Verify password.
    const validPassword = await bcrypt.compare(
      password,
      user.password_hash,
    );

    if (!validPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    // Generate JWT.
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    // Generate a temporary URL for the profile picture.
    let profilePicUrl = null;

    if (user.profile_pic_key) {
      profilePicUrl = await generatePresignedUrl(
        user.profile_pic_key,
      );

      // ==========================================
      // DEBUG: Print temporary presigned profile URL on login
      // ==========================================
      console.log('>>> [DEBUG] Generated Login Profile Pic Presigned URL:', profilePicUrl);
    }

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        contact: user.contact,
        sector: user.sector,
        profile_pic_url: profilePicUrl,
      },
    });
  } catch (error) {
    console.error('Error logging in:', error.message);

    res.status(500).json({
      error: 'Server error during login',
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    // The authentication middleware must set req.user.
    const userId = req.user.id;
    const { name, sector } = req.body;

    // multer-s3 provides the uploaded object's key.
    const profilePicKey = req.file ? req.file.key : undefined;

    const updates = [];
    const params = [];

    if (name !== undefined) {
      params.push(name);
      updates.push(`name = $${params.length}`);
    }

    if (sector !== undefined) {
      params.push(sector);
      updates.push(`sector = $${params.length}`);
    }

    if (profilePicKey !== undefined) {
      params.push(profilePicKey);
      updates.push(`profile_pic_key = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No profile changes were provided',
      });
    }

    params.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, name, role, contact, sector, profile_pic_key
    `;

    const updatedUserResult = await pool.query(query, params);

    if (updatedUserResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    const user = updatedUserResult.rows[0];

    let profilePicUrl = null;

    if (user.profile_pic_key) {
      profilePicUrl = await generatePresignedUrl(
        user.profile_pic_key,
      );

      // ==========================================
      // DEBUG: Print temporary presigned profile URL on update
      // ==========================================
      console.log('>>> [DEBUG] Generated Update Profile Pic Presigned URL:', profilePicUrl);
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        contact: user.contact,
        sector: user.sector,
        profile_pic_key: user.profile_pic_key,
        profile_pic_url: profilePicUrl,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error.message);

    res.status(500).json({
      error: 'Server error during profile update',
    });
  }
};

module.exports = {
  register,
  login,
  updateProfile,
};
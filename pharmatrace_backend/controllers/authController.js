const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
  try {
    const { name, role, wallet_address, contact, password } = req.body;

    // Check if user already exists
    const userExists = await pool.query('SELECT * FROM users WHERE contact = $1', [contact]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User with this contact already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user into PostgreSQL
    const newUser = await pool.query(
      'INSERT INTO users (name, role, wallet_address, contact, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, role, contact',
      [name, role, wallet_address, contact, passwordHash]
    );

    res.status(201).json({ message: 'User registered successfully', user: newUser.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

const login = async (req, res) => {
  try {
    const { contact, password } = req.body;

    // Find user
    const userResult = await pool.query('SELECT * FROM users WHERE contact = $1', [contact]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // Token valid for 1 week
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server error during login' });
  }
};

module.exports = { register, login };

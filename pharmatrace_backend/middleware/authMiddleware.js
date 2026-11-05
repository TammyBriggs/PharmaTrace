const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to the request object
    // A token from a temporary-password sign-in only works for changing the password.
    if (decoded.mcp && !req.originalUrl.startsWith('/api/auth/change-password')) {
      return res.status(403).json({ error: 'Choose a new password before continuing.', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    next(); // Pass control to the next middleware/controller
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = verifyToken;
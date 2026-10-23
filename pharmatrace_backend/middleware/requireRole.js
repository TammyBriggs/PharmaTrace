// super_admin passes every role check (demo shortcut: acts as regulator + manufacturer).
const requireRole = (...allowed) => (req, res, next) => {
  const role = req.user && req.user.role;
  if (role === 'super_admin' || allowed.includes(role)) return next();
  return res.status(403).json({ error: 'You do not have permission to do this.' });
};
module.exports = requireRole;
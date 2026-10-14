const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

module.exports = function optionalAuth(req, res, next) {
  const [type, token] = (req.headers.authorization || '').split(' ');
  if (type === 'Bearer' && token) {
    try {
      const p = jwt.verify(token, JWT_SECRET);
      req.user = { id: Number(p.sub), username: p.username };
    } catch (_) { /* token salah → anggap tamu */ }
  }
  next();
};
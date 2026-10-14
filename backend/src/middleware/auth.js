const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

module.exports = function auth(req, res, next) {
    const h = req.headers.authorization || '';
    const [type, token] = h.split(' ');
    if (type !== 'Bearer' || !token)
        return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Token tidak ada' });
    try {
        const p = jwt.verify(token, JWT_SECRET);
        req.user = { id: Number(p.sub), username: p.username };
        next();
    } catch (e) {
        const code = e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
        res.status(401).json({ error: code, message: 'Token tidak valid / kedaluwarsa' });
    }
};
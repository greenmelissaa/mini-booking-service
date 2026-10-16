// ini untuk periksa token login, tapi ga ditolak equestnya kalau gaada token
// ini dipake di halaman liat kursi (boleh dibuka tanpa harus login)
// kalau user udah login, nanti bisa tau kursi mana yang user kunci

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

module.exports = function optionalAuth(req, res, next) {
  // ini untuk ambil token dari header "Bearer <token>"
  const [type, token] = (req.headers.authorization || '').split(' ');

  // ini kalau ada token
  if (type === 'Bearer' && token) {
    try {
      // ini untuk periksa tokennya. kalau valid, nanti data user disimpan
      const p = jwt.verify(token, JWT_SECRET);
      req.user = { id: Number(p.sub), username: p.username };
    } catch (_) { 
      // kalau tokennya salah atau habis, nanti diabaikan, user nanti jadinya dianggap belum login
    }
  }

  // ini untuk selalu lanjut ke proses berikutnya 
  next();
};
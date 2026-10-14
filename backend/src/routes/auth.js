const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_SECRET, ACCESS_TTL, REFRESH_TTL_DAYS } = require('../config');

module.exports = function authRoutes(db, clock = { now: () => Date.now() }) {
  const router = express.Router();

  const q = {
    userByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    userById: db.prepare('SELECT id, username, name FROM users WHERE id = ?'),
    insRefresh: db.prepare('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)'),
    getRefresh: db.prepare('SELECT * FROM refresh_tokens WHERE token = ?'),
    delRefresh: db.prepare('DELETE FROM refresh_tokens WHERE token = ?'),
  };

  // Membuat pasangan token: access token (JWT) + refresh token (string acak di DB)
  function issueTokens(user) {
    const accessToken = jwt.sign(
      { sub: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: ACCESS_TTL }
    );
    const { exp, iat } = jwt.decode(accessToken);   // hitung masa berlaku dalam detik
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshExp = clock.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
    q.insRefresh.run(refreshToken, user.id, refreshExp);

    return {
      accessToken,
      refreshToken,
      expiresIn: exp - iat,          // misal 900 (detik) untuk '15m'
      tokenType: 'Bearer',
      user: { id: user.id, username: user.username, name: user.name },
    };
  }

  // POST /api/auth/login
  router.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'username dan password wajib diisi' });
    }
    const user = q.userByUsername.get(username);
    // Pesan sengaja dibuat sama, supaya tidak membocorkan username mana yang ada
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Username atau password salah' });
    }
    res.json(issueTokens(user));
  });

  // POST /api/auth/refresh (bonus)
  router.post('/refresh', (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'refreshToken wajib diisi' });
    }
    const row = q.getRefresh.get(refreshToken);
    if (!row || row.expires_at <= clock.now()) {
      if (row) q.delRefresh.run(refreshToken);       // bersihkan yang kedaluwarsa
      return res.status(401).json({ error: 'REFRESH_INVALID', message: 'Refresh token tidak valid / kedaluwarsa, silakan login ulang' });
    }
    const user = q.userById.get(row.user_id);

    // Rotasi: hapus yang lama, terbitkan yang baru (dalam 1 transaksi)
    const result = db.transaction(() => {
      q.delRefresh.run(refreshToken);
      return issueTokens(user);
    })();
    res.json(result);
  });

  // POST /api/auth/logout
  router.post('/logout', (req, res) => {
    const { refreshToken } = req.body || {};
    if (refreshToken) q.delRefresh.run(refreshToken);
    res.json({ message: 'Logout berhasil' });
  });

  return router;
};
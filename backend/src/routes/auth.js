// endpoint untuk login:
// POST /api/auth/login   -> ini untuk login, nanti dapat access token sama bisa refresh token
// POST /api/auth/refresh -> ini untuk tukar token yang direfresh jadi token yang baru 
// POST /api/auth/logout  -> ini untuk logout, sama hapus refresh token

// ada 2 jenis token:
// - access token  : ini dipake di setiap request yang perlu login. bisa 15 menit
// - refresh token : ini dipake untuk minta access token baru. ini bisa 7 hari


const express = require('express');
const bcrypt = require('bcryptjs');   // ini untuk ngecocokin password sama hasil enkripsinya
const jwt = require('jsonwebtoken');  // ini untuk bikin access token
const crypto = require('crypto');     // ini untuk bikin teks acak
const { JWT_SECRET, ACCESS_TTL, REFRESH_TTL_DAYS } = require('../config');

module.exports = function authRoutes(db, clock = { now: () => Date.now() }) {
  // Router = ini kumpulan endpoint
  const router = express.Router();

  // ini perintah SQL yang dipake di file ini 
  const q = {
    userByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),       // ini untuk cari user sesuai sama usernamnya
    userById: db.prepare('SELECT id, username, name FROM users WHERE id = ?'),  // ini untuk cari user sesuai idnya
    insRefresh: db.prepare('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)'),
                                                                                // ini untuk simpan token yang direfresh
    getRefresh: db.prepare('SELECT * FROM refresh_tokens WHERE token = ?'),     // ini untuk cari token yang direfresh
    delRefresh: db.prepare('DELETE FROM refresh_tokens WHERE token = ?'),       // ini untuk hapus token yang direfresh
  };

  // ini untuk bikin access token dan refresh token untuk user
  function issueTokens(user) {
    // ini untuk access token yang isinya id, sama username user
    // nanti ditandatanganin pake kunci rahasia (bisa 15 menit)
    const accessToken = jwt.sign(
      { sub: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: ACCESS_TTL }
    );

    // ini untuk ambil waktu dibikin (iat) sama waktu habis (exp) dari token 
    const { exp, iat } = jwt.decode(accessToken);   // ini ngehitung lama berlaku dalam detik (900 detik)
    
    // refresh token = 64 karakter acak
    const refreshToken = crypto.randomBytes(32).toString('hex');
    
    // waktu refresh token berakhir: 7 hari dari sekarang
    const refreshExp = clock.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
    
    // ini untuk simpan refresh token ke database
    q.insRefresh.run(refreshToken, user.id, refreshExp);

    // ini data yang dikirim ke frontend 
    return {
      accessToken,
      refreshToken,
      expiresIn: exp - iat,          // lama access token berlaku 
      tokenType: 'Bearer',           // cara pakai: "Bearer <token>"
      user: { id: user.id, username: user.username, name: user.name }, // passwordnya gaikut dikirim
    };
  }

  // LOGIN
  // POST /api/auth/login
  router.post('/login', (req, res) => {

    // ini mengambil username sama password dari request
    const { username, password } = req.body || {};

    // kalau ada yang kosong, nanti ditolak pake status 400 (datanya ga lengkap)
    if (!username || !password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'username dan password wajib diisi' });
    }

    // cari user di database
    const user = q.userByUsername.get(username);

    // kalau user gaada atau passwordnya salah, nanti ditolak
    // nanti pesannya sama untuk 2 case ini, 
    // supaya orang lain ga bisa tau username mana yang ada di daftar
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Username atau password salah' });
    }

    // kalau login berhasil, nanti tokennya kekirim
    res.json(issueTokens(user));
  });

  // POST /api/auth/refresh
  // ini untuk refresh token
  router.post('/refresh', (req, res) => {
    // untuk ambil request token dari request
    const { refreshToken } = req.body || {};

    // ini refresh tokennya wajib dikirim
    if (!refreshToken) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'refreshToken wajib diisi' });
    }

    // ini untuk cari refresh token di databse
    const row = q.getRefresh.get(refreshToken);

    // kalau token ga ditemukan atau sudah habis, nanti ditolak terus user harus login ulang 
    if (!row || row.expires_at <= clock.now()) {
      if (row) q.delRefresh.run(refreshToken);       // kalau token udah habis, nanti dihapus
      return res.status(401).json({ error: 'REFRESH_INVALID', message: 'Refresh token tidak valid / kedaluwarsa, silakan login ulang' });
    }

    // ini untuk ambil data pemilik token 
    const user = q.userById.get(row.user_id);

    // hapus refresh token lama, terus buat token yang baru
    // jadi semua refresh token hanya bisa dipake satu kali
    const result = db.transaction(() => {
      q.delRefresh.run(refreshToken);
      return issueTokens(user);
    })();
    res.json(result);
  });

  // POST /api/auth/logout - untuk logout
  router.post('/logout', (req, res) => {
    const { refreshToken } = req.body || {};
    // ini untuk refresh token dari database supaya tidak bisa dipake lagi.
    if (refreshToken) q.delRefresh.run(refreshToken);
    res.json({ message: 'Logout berhasil' });
  });

  return router;
};
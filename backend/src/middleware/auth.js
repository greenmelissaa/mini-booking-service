// ini untuk memeriksa token login sebelum requestnya diproses
// ini dipake di fitur yang wajib login: ada kunci kursi dan konfirmasi booking
// kalau tokennya gaada, salah, atau udah habis, requestnya ditolak

// library ini untuk buat dan untuk periksa token login (JWT)
const jwt = require('jsonwebtoken');

// ini adalah kunci rahasia untuk memeriksa token 
const { JWT_SECRET } = require('../config');

// req = request yang masuk, res = response yang dikirim,
// next = lanjut ke proses berikutnya
module.exports = function auth(req, res, next) {
    // ini untuk ambil header authorization. 
    // kalau gaada, jadinya pakenya teks kosong
    const h = req.headers.authorization || '';

    // format header: "Bearer <token>"
    // pisahkan menjadi kata "Bearer" dan isi token
    const [type, token] = h.split(' ');

    // kalau gaada token - nanti di tolak jadi 401 (belum login)
    if (type !== 'Bearer' || !token)
        return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Token tidak ada' });

    try {
        // periksa token: tokennya asli sama belum habis waktunya
        // kalau ga lolos, langsung lompat ke bagian catch
        const p = jwt.verify(token, JWT_SECRET);

        // kalau token valid, nanti data usernya disimpan
        // supaya bisa dipake di proses berikutnya
        req.user = { id: Number(p.sub), username: p.username };

        // ini lanjut ke proses berikutnya
        next();
    } catch (e) {
        // tokenya ditolak, alasannya dibedain
        // TOKER_EXPIRED = tokennya udah habis waktunya
        // TOKEN_INVALID = tokennya salah atauga palsu
        const code = e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
        res.status(401).json({ error: code, message: 'Token tidak valid / kedaluwarsa' });
    }
};
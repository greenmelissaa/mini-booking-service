// untuk nyusun aplikasi: daftarin semua endpoint, rate limit, penanganan error
// dibuat sebagai fungsi createApp supaya bisa dipake dengan pengaturan yang berbeda:
// - server.js  : databse file dan waktu asli
// - testing    : database sementara, waktu palsu, tanpa rate limit

const express = require('express');
const cors = require('cors');
const rateLimitLib = require('express-rate-limit');
const { LOCK_TTL_MS } = require('./config');
const authRoutes = require('./routes/auth');
const scheduleRoutes = require('./routes/schedules');
const lockRoutes = require('./routes/locks');
const bookingRoutes = require('./routes/bookings');
const { createBookingService, AppError } = require('./services/booking.service');

function createApp({
  db,
  clock = { now: () => Date.now() },
  lockTtlMs = LOCK_TTL_MS,
  rateLimit = true,          // di test diset false
}) {
  const app = express();

  // dipake bareng sama endpoint kunci kursi sama booking
  const svc = createBookingService(db, clock, lockTtlMs);

  app.use(cors());
  app.use(express.json());

  // Rate limit hanya untuk pencarian jadwal
  if (rateLimit) {
    app.use('/api/schedules', rateLimitLib({
      windowMs: 60_000,
      max: 30,
      standardHeaders: true,    // kirim info sisa kuota ke browser
      legacyHeaders: false,     // gapake format info versi lama
      // hanya untuk pencarian jadwal
      message: { error: 'RATE_LIMITED', message: 'Terlalu banyak request, coba lagi nanti' },
    }));
  }

  // Publik
  // kalau tanpa login
  app.use('/api/auth', authRoutes(db, clock));            // login, refresh, logout
  app.use('/api/schedules', scheduleRoutes(db, clock));   // cari jadwal, detail, status kursi
  
  // daftar rute, untuk pilihan kota asal sama tujuan di frontend
  app.get('/api/routes', (req, res) =>
    res.json(db.prepare('SELECT id, origin, destination FROM routes ORDER BY origin').all())
  );

  // ambil api operator yang ada di db.js 
  app.get('/api/operator', (req, res) => 
    res.json(db.prepare('SELECT id, name FROM operators').all())
  );
  
  // Terproteksi (butuh token) - endpoint wajib login
  app.use('/api/locks', lockRoutes(svc));
  app.use('/api/bookings', bookingRoutes(svc, db));

  // 404 untuk endpoint yang tidak ada
  app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint tidak ditemukan' }));

  // Error handler global (harus paling akhir, 4 parameter)
  app.use((err, req, res, next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.code, message: err.message, ...err.extra });
    }
    // isi request bukan JSON yang benar, nanti statusnya 400
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Body JSON tidak valid' });
    }

    // kalau ada error lain, nanti ditampilinnya di terminal
    // terus ada pesan umum ke user
    console.error(err);
    res.status(500).json({ error: 'INTERNAL', message: 'Terjadi kesalahan pada server' });
  });

  // untuk simpan fungsi booking, supaya bisa dipake di server.js sama file test
  app.locals.svc = svc;      
  return app;
}


module.exports = { createApp };
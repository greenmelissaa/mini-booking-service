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
  const svc = createBookingService(db, clock, lockTtlMs);

  app.use(cors());
  app.use(express.json());

  // Rate limit hanya untuk pencarian jadwal (Tahap 9, bonus)
  if (rateLimit) {
    app.use('/api/schedules', rateLimitLib({
      windowMs: 60_000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'RATE_LIMITED', message: 'Terlalu banyak request, coba lagi nanti' },
    }));
  }

  // Publik
  app.use('/api/auth', authRoutes(db, clock));
  app.use('/api/schedules', scheduleRoutes(db, clock));
  app.get('/api/routes', (req, res) =>
    res.json(db.prepare('SELECT id, origin, destination FROM routes ORDER BY origin').all())
  );

  // Terproteksi (butuh token)
  app.use('/api/locks', lockRoutes(svc));
  app.use('/api/bookings', bookingRoutes(svc, db));

  // 404 untuk endpoint yang tidak ada
  app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint tidak ditemukan' }));

  // Error handler global (harus paling akhir, 4 parameter)
  app.use((err, req, res, next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.code, message: err.message, ...err.extra });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Body JSON tidak valid' });
    }
    console.error(err);
    res.status(500).json({ error: 'INTERNAL', message: 'Terjadi kesalahan pada server' });
  });

  app.locals.svc = svc;      // dipakai di test: app.locals.svc.purgeExpired()
  return app;
}

module.exports = { createApp };
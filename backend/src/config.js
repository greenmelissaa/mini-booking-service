// isinya semua pengaturan aplikasi

require('dotenv').config();
module.exports = {
  PORT: process.env.PORT || 3001,
  DB_FILE: process.env.DB_FILE || 'booking.db',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-ganti-di-produksi',
  ACCESS_TTL: process.env.ACCESS_TTL || '15m',
  REFRESH_TTL_DAYS: 7,
  LOCK_TTL_MS: Number(process.env.LOCK_TTL_MS || 5 * 60 * 1000), // 5 menit
  BOOKING_CUTOFF_MINUTES: Number(process.env.BOOKING_CUTOFF_MINUTES || 0), 
};
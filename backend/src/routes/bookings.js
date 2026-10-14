const express = require('express');
const auth = require('../middleware/auth');
const { AppError } = require('../services/booking.service');

module.exports = function bookingRoutes(svc, db) {
  const router = express.Router();
  router.use(auth);

  // POST /api/bookings  body: { scheduleId, seatIds }
  router.post('/', (req, res, next) => {
    try {
      const { scheduleId, seatIds } = req.body || {};
      if (!Number.isInteger(scheduleId) || !Array.isArray(seatIds) || seatIds.length === 0)
        throw new AppError(400, 'VALIDATION_ERROR', 'scheduleId dan seatIds wajib diisi');
      const result = svc.confirmBooking(req.user.id, scheduleId, [...new Set(seatIds)]);
      res.status(201).json({ message: 'Pemesanan berhasil', ...result });
    } catch (e) { next(e); }
  });

  // GET /api/bookings/me  → riwayat pemesanan user
  router.get('/me', (req, res) => {
    const rows = db.prepare(`
      SELECT b.id, b.code, b.total_price, b.created_at,
             s.departure_time, r.origin, r.destination, o.name AS operator,
             GROUP_CONCAT(se.seat_number) AS seats
      FROM bookings b
      JOIN schedules s ON s.id = b.schedule_id
      JOIN routes r ON r.id = s.route_id
      JOIN operators o ON o.id = s.operator_id
      JOIN booking_seats bs ON bs.booking_id = b.id
      JOIN seats se ON se.id = bs.seat_id
      WHERE b.user_id = ?
      GROUP BY b.id ORDER BY b.created_at DESC`).all(req.user.id);
    res.json(rows.map(r => ({ ...r, seats: r.seats.split(',') })));
  });

  return router;
};
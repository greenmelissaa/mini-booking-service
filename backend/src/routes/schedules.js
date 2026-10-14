const express = require('express');
const optionalAuth = require('../middleware/optionalAuth');

module.exports = function scheduleRoutes(db, clock = { now: () => Date.now() }) {
  const router = express.Router();

  const q = {
    search: db.prepare(`
      SELECT s.id, s.departure_time, s.arrival_time, s.price,
             o.name AS operator, r.origin, r.destination,
             (SELECT COUNT(*) FROM seats se
               WHERE se.schedule_id = s.id
                 AND se.id NOT IN (SELECT seat_id FROM booking_seats)
                 AND se.id NOT IN (SELECT seat_id FROM seat_locks WHERE expires_at > @now)
             ) AS available_seats,
             (SELECT COUNT(*) FROM seats se WHERE se.schedule_id = s.id) AS total_seats
      FROM schedules s
      JOIN routes r ON r.id = s.route_id
      JOIN operators o ON o.id = s.operator_id
      WHERE r.origin = @origin AND r.destination = @destination
        AND s.departure_time >= @start AND s.departure_time < @end
      ORDER BY s.departure_time`),

    detail: db.prepare(`
      SELECT s.id, s.departure_time, s.arrival_time, s.price,
             o.name AS operator, r.origin, r.destination
      FROM schedules s
      JOIN routes r ON r.id = s.route_id
      JOIN operators o ON o.id = s.operator_id
      WHERE s.id = ?`),

    seats: db.prepare(`
      SELECT se.id, se.seat_number,
        CASE WHEN bs.seat_id IS NOT NULL THEN 'BOOKED'
             WHEN l.id IS NOT NULL THEN 'LOCKED'
             ELSE 'AVAILABLE' END AS status,
        l.user_id AS locked_by, l.expires_at
      FROM seats se
      LEFT JOIN booking_seats bs ON bs.seat_id = se.id
      LEFT JOIN seat_locks l ON l.seat_id = se.id AND l.expires_at > @now
      WHERE se.schedule_id = @id
      ORDER BY se.id`),
  };

  // (a) GET /api/schedules?origin=Bandung&destination=Jakarta&date=2026-10-15
  router.get('/', (req, res) => {
    const { origin, destination, date } = req.query;

    if (!origin || !destination || !date) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'origin, destination, dan date wajib diisi' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Format date harus YYYY-MM-DD' });
    }

    // Rentang 1 hari penuh dalam WIB (UTC+7), dikonversi ke ISO/UTC seperti di DB
    const startDate = new Date(`${date}T00:00:00+07:00`);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Tanggal tidak valid' });
    }
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

    const rows = q.search.all({
      origin, destination,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      now: clock.now(),
    });
    res.json(rows);
  });

  // Detail 1 jadwal (dipakai halaman ringkasan di frontend)
  router.get('/:id', (req, res) => {
    const row = q.detail.get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'SCHEDULE_NOT_FOUND', message: 'Jadwal tidak ditemukan' });
    res.json(row);
  });

  // (b) GET /api/schedules/:id/seats
  router.get('/:id/seats', optionalAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!q.detail.get(id)) {
      return res.status(404).json({ error: 'SCHEDULE_NOT_FOUND', message: 'Jadwal tidak ditemukan' });
    }
    const myId = req.user ? req.user.id : null;

    const seats = q.seats.all({ id, now: clock.now() }).map(s => ({
      id: s.id,
      seat_number: s.seat_number,
      status: s.status,
      lockedByMe: s.status === 'LOCKED' && myId !== null && s.locked_by === myId,
      lockExpiresAt: s.status === 'LOCKED' && s.locked_by === myId ? s.expires_at : null,
      // locked_by TIDAK dikirim → privasi user lain terjaga
    }));
    res.json(seats);
  });

  return router;
};
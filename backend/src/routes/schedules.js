// endpoint yang bisa dibuka tanpa login:
// GET /api/schedule?origin=&destination=&date=   -> untuk cari jadwal
// GET /api/schedules/:id                         -> untuk detail satu jadwal
// GET /api/schedules/:id/seats                   -> untuk status semua kursi

const express = require('express');
const { isBookingClosed } = require('../scheduleRules');
const optionalAuth = require('../middleware/optionalAuth');

module.exports = function scheduleRoutes(db, clock = { now: () => Date.now() }) {
  const router = express.Router();

  // perintah SQL yang dipake di file ini
  // @origin, @now, dll nanti diganti sama nilai pas perintah dijalankan
  const q = {
    // untuk cari jadwal berdasarkan rute dan tanggal
    // sekaligus untuk hitung jumlah kursi yang masih kosong
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
      ORDER BY s.departure_time`),    // untuk bikin urutan dari yang paling pagi

    // ini untuk ambil detaul satu jadwal
      detail: db.prepare(`
      SELECT s.id, s.departure_time, s.arrival_time, s.price,
             o.name AS operator, r.origin, r.destination
      FROM schedules s
      JOIN routes r ON r.id = s.route_id
      JOIN operators o ON o.id = s.operator_id
      WHERE s.id = ?`),

    // untuk ambil semua kursi dalam satu jadwal sama statusnya
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
  // cari jadwal
  router.get('/', (req, res) => {
    // untuk ambil kota asal, kota tujuan, sama tanggal dari URL
    const { origin, destination, date } = req.query;

    // semua ini wajib diisi
    if (!origin || !destination || !date) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'origin, destination, dan date wajib diisi' });
    }

    // format tanggalnya harus yyyy-mm-dd
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Format date harus YYYY-MM-DD' });
    }

    // awal hari, di jam 00.00 wib
    const startDate = new Date(`${date}T00:00:00+07:00`);
    
    // tanggal yang gaada (bulan 13), nanti ditolak
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Tanggal tidak valid' });
    }
    
    // akhir hari = awal hari + 24 jam
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

    // untuk jalanin pencarian
    const rows = q.search.all({
      origin, destination,
      start: startDate.toISOString(),   // untuk ganti format waktu yang sama sama yang di database
      end: endDate.toISOString(),
      now: clock.now(),                 // untuk waktu sekarang, untuk mengabaikan kunci yang udah habis
    });
    const now = clock.now();
    res.json(rows.map(row => {
      const closed = isBookingClosed(row.departure_time, now);
      return {
        ...row,                                             // untuk salin semua data jadwal
        booking_closed: closed,                             // true, kalau udah ga bisa dipesan lagi
        available_seats: closed ? 0 : row.available_seats,  // kalau busnya udah berangkat, ga bisa pilih kursi lagi
      };
    }));
  });

  // Detail 1 jadwal (dipakai halaman ringkasan di frontend)
  router.get('/:id', (req, res) => {
    // untuk ambil id jadwal dari URL, diganti ke angka, baru dicari
    const row = q.detail.get(Number(req.params.id));
    // kalau gaditemukan, status jadi 404
    if (!row) return res.status(404).json({ error: 'SCHEDULE_NOT_FOUND', message: 'Jadwal tidak ditemukan' });
    
    // tambahin info apakah jadwal masih bisa dipesan
    res.json({ ...row, booking_closed: isBookingClosed(row.departure_time, clock.now()) });
  });

  // (b) GET /api/schedules/:id/seats
  // untuk status kursi
  // optionalAuth dipasang supaya kalau user udah login, nanti bisa ditandai kursi yang dikunci sendiri
  router.get('/:id/seats', optionalAuth, (req, res) => {
    const id = Number(req.params.id);
    
    // untuk memastikan jadwal yang ada
    const schedule = q.detail.get(id);
    if (!schedule) {
      return res.status(404).json({ error: 'SCHEDULE_NOT_FOUND', message: 'Jadwal tidak ditemukan' });
    }

    const now = clock.now();

    // apakah busnya udah berangkat?
    const closed = isBookingClosed(schedule.departure_time, now);

    // id user yang lagi login, atau null kalau usernya belom login
    const myId = req.user ? req.user.id : null;

    // untuk menyiapkan data kursi yang akan dikirim
    const seats = q.seats.all({ id, now }).map(s => {
      // kalau busnya udah berangkat, kursinya gabisa dipesan lagi
      const status = closed && s.status !== 'BOOKED' ? 'CLOSED' : s.status;

      return {
        id: s.id,
        seat_number: s.seat_number,
        status,
        // akan true kalau kursinya dibook sama user yang lagi login
        lockedByMe: status === 'LOCKED' && myId !== null && s.locked_by === myId,
        // hitung mundur book kursi untuk diri sendiri
        lockExpiresAt: status === 'LOCKED' && s.locked_by === myId ? s.expires_at : null,
        // Id user lain yang booking kursi ga dikirim, itu untuk privasi
      };
    });
    res.json(seats);
  });

  return router;
};
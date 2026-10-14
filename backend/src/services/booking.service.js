class AppError extends Error {
  constructor(status, code, message, extra = {}) { super(message); Object.assign(this, { status, code, extra }); }
}

function createBookingService(db, clock, lockTtlMs) {
  const q = {
    purge: db.prepare('DELETE FROM seat_locks WHERE expires_at <= ?'),
    seat: db.prepare('SELECT id FROM seats WHERE id = ? AND schedule_id = ?'),
    booked: db.prepare('SELECT 1 FROM booking_seats WHERE seat_id = ?'),
    lockOf: db.prepare('SELECT * FROM seat_locks WHERE seat_id = ?'),
    insLock: db.prepare('INSERT INTO seat_locks (seat_id,user_id,expires_at) VALUES (?,?,?)'),
    extend: db.prepare('UPDATE seat_locks SET expires_at = ? WHERE id = ?'),
  };

  // All-or-nothing: semua kursi berhasil dikunci, atau tidak sama sekali (transaksi di rollback)
  const lockTx = db.transaction((userId, scheduleId, seatIds) => {
    const now = clock.now();
    q.purge.run(now);                                   // lepas lock kedaluwarsa dulu
    const expiresAt = now + lockTtlMs;
    for (const seatId of seatIds) {
      if (!q.seat.get(seatId, scheduleId)) throw new AppError(404, 'SEAT_NOT_FOUND', `Kursi ${seatId} tidak ada`);
      if (q.booked.get(seatId)) throw new AppError(409, 'SEAT_BOOKED', 'Kursi sudah dipesan', { seatId });
      const ex = q.lockOf.get(seatId);
      if (ex && ex.user_id !== userId) throw new AppError(409, 'SEAT_LOCKED', 'Kursi sedang dikunci pengguna lain', { seatId });
      if (ex) q.extend.run(expiresAt, ex.id);
      else q.insLock.run(seatId, userId, expiresAt);     // UNIQUE(seat_id) = jaring pengaman terakhir
    }
    return { seatIds, expiresAt };
  });

  function lockSeats(userId, scheduleId, seatIds) {
    try {
      return lockTx.immediate(userId, scheduleId, seatIds); // BEGIN IMMEDIATE database siambil di awal transaksi, transaksi kedua harus nunggu sampai transaksi pertama commit
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new AppError(409, 'SEAT_LOCKED', 'Kursi sedang dikunci');
      throw e;
    }
  }

  const confirmTx = db.transaction((userId, scheduleId, seatIds) => {
    const now = clock.now();
    q.purge.run(now);
    const ph = seatIds.map(() => '?').join(',');
    const locks = db.prepare(
      `SELECT l.seat_id FROM seat_locks l JOIN seats s ON s.id = l.seat_id
       WHERE l.user_id = ? AND s.schedule_id = ? AND l.seat_id IN (${ph}) AND l.expires_at > ?`
    ).all(userId, scheduleId, ...seatIds, now);
    if (locks.length !== seatIds.length)
      throw new AppError(410, 'LOCK_EXPIRED', 'Lock kedaluwarsa atau bukan milik Anda');

    const price = db.prepare('SELECT price FROM schedules WHERE id = ?').get(scheduleId).price;
    const code = 'BK' + now.toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    const b = db.prepare('INSERT INTO bookings (code,user_id,schedule_id,total_price,created_at) VALUES (?,?,?,?,?)')
      .run(code, userId, scheduleId, price * seatIds.length, now);
    const insBs = db.prepare('INSERT INTO booking_seats (booking_id, seat_id) VALUES (?,?)');
    for (const s of seatIds) insBs.run(b.lastInsertRowid, s);   // UNIQUE(seat_id) cegah double booking
    db.prepare(`DELETE FROM seat_locks WHERE user_id = ? AND seat_id IN (${ph})`).run(userId, ...seatIds);
    return { bookingId: b.lastInsertRowid, code, totalPrice: price * seatIds.length, seatIds };
  });

  const confirmBooking = (u, s, ids) => {
    try { return confirmTx.immediate(u, s, ids); }
    catch (e) { if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new AppError(409, 'SEAT_BOOKED', 'Kursi sudah dipesan'); throw e; }
  };

  const releaseLocks = (userId, seatIds) => { /* DELETE milik user ini saja, untuk tombol "Batal" */ };
  const purgeExpired = () => q.purge.run(clock.now()).changes;

  return { lockSeats, confirmBooking, releaseLocks, purgeExpired };
}
module.exports = { createBookingService, AppError };
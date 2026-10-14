const express = require('express');
const auth = require('../middleware/auth');
const { AppError } = require('../services/booking.service');

function validateBody(body, needSchedule = true) {
  const { scheduleId, seatIds } = body || {};
  if (needSchedule && !Number.isInteger(scheduleId))
    throw new AppError(400, 'VALIDATION_ERROR', 'scheduleId wajib berupa angka');
  if (!Array.isArray(seatIds) || seatIds.length === 0 || !seatIds.every(Number.isInteger))
    throw new AppError(400, 'VALIDATION_ERROR', 'seatIds wajib berupa array angka, minimal 1');
  if (seatIds.length > 4)
    throw new AppError(400, 'VALIDATION_ERROR', 'Maksimal 4 kursi per pemesanan');
  return { scheduleId, seatIds: [...new Set(seatIds)] };   // buang duplikat
}

module.exports = function lockRoutes(svc) {
  const router = express.Router();
  router.use(auth);                         // semua endpoint di sini wajib token

  // POST /api/locks  body: { scheduleId, seatIds }
  router.post('/', (req, res, next) => {
    try {
      const { scheduleId, seatIds } = validateBody(req.body);
      const result = svc.lockSeats(req.user.id, scheduleId, seatIds);
      res.status(201).json({ message: 'Kursi berhasil dikunci', ...result });
    } catch (e) { next(e); }
  });

  // DELETE /api/locks  body: { seatIds }  → batalkan lock milik sendiri
  router.delete('/', (req, res, next) => {
    try {
      const { seatIds } = validateBody(req.body, false);
      const released = svc.releaseLocks(req.user.id, seatIds);
      res.json({ message: 'Lock dilepas', released });
    } catch (e) { next(e); }
  });

  return router;
};
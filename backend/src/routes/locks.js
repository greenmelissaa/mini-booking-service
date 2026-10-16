// endpoint harus login:
// POST /api/locks    -> kunci kursi selama 5 menit
// DELETE /api/locks  -> lepas kunci kursi (saat tombol "Batal" ditekan)

const express = require('express');
const auth = require('../middleware/auth');
const { AppError } = require('../services/booking.service');

// memeriksa isi request
// needSchedule = apakah scheduleId wajib diisi (tidak wajib untuk lepas kunci)
function validateBody(body, needSchedule = true) {
  const { scheduleId, seatIds } = body || {};

  // scheduleId harus angka bulat
  if (needSchedule && !Number.isInteger(scheduleId))
    throw new AppError(400, 'VALIDATION_ERROR', 'scheduleId wajib berupa angka');
  
  // seatIds harus berupa daftar angka terus gaboleh kosong
  if (!Array.isArray(seatIds) || seatIds.length === 0 || !seatIds.every(Number.isInteger))
    throw new AppError(400, 'VALIDATION_ERROR', 'seatIds wajib berupa array angka, minimal 1');
  
  // maksimal 4 kursi dalam satu pemesanan
  if (seatIds.length > 4)
    throw new AppError(400, 'VALIDATION_ERROR', 'Maksimal 4 kursi per pemesanan');
  
  // hapus id kursi yang double, contoh [3, 3] jadinya [3]
  return { scheduleId, seatIds: [...new Set(seatIds)] };
}

// svc = kumpulan fungsi booking dari booking.service.js
module.exports = function lockRoutes(svc) {
  const router = express.Router();
  
  // semua endpoint di file ini wajib untuk login
  router.use(auth);                        

  // POST /api/locks  body: { scheduleId, seatIds }
  // kunci kursi
  router.post('/', (req, res, next) => {
    try {
      // untuk periksa isi request
      const { scheduleId, seatIds } = validateBody(req.body);
      
      // untuk kunci kursi atas nama user yang lagi login
      const result = svc.lockSeats(req.user.id, scheduleId, seatIds);
      
      // kalau berhasil statusnya 201
      res.status(201).json({ message: 'Kursi berhasil dikunci', ...result });
    } catch (e) { 
      // kalau gagal, nanti kekirim error ke error handler di app.js
      next(e);
    }
  });

  // DELETE /api/locks  body: { seatIds }  → lepas kunci
  router.delete('/', (req, res, next) => {
    try {
      const { seatIds } = validateBody(req.body, false);
      // lepas kunci, nanti kuncinya yang cuman punya user ini yang bisa dilepas
      const released = svc.releaseLocks(req.user.id, seatIds);
      res.json({ message: 'Lock dilepas', released });
    } catch (e) { next(e); }
  });

  return router;
};
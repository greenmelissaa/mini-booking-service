// Menghapus baris lock yang sudah kedaluwarsa dari database secara berkala.
// (Lazy expiry sudah membuat lock kedaluwarsa tidak berlaku;
//  job ini membersihkan sisa barisnya agar tabel tetap rapi.)
module.exports = function startLockCleaner(svc, intervalMs = 30_000) {
  const timer = setInterval(() => {
    try {
      const n = svc.purgeExpired();
      if (n > 0) console.log(`[cleaner] ${n} lock kedaluwarsa dilepas`);
    } catch (e) {
      console.error('[cleaner] gagal:', e.message);
    }
  }, intervalMs);

  timer.unref();   // tidak menahan proses Node saat ingin dimatikan
  return timer;
};
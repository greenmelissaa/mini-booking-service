// Setiap 30 detik, menghapus data kunci kursi yang sudah habis waktunya.
// kunci yang sudah habis sebenarnya sudah tidak berlaku,
// karena semua pengecekan memakai "expires_at > sekarang".
// Ini itu untuk membersihkan datanya dari tabel supaya rapih.

// svc = kumpulan fungsi booking (isinya fungsi purgeExpired).
// intervalMs = jeda antar pembersihan, defaultnya 30 detik.

module.exports = function startLockCleaner(svc, intervalMs = 30_000) {
  // jalankan fungsi di bawah ini berulang setiap intervalMs.
  const timer = setInterval(() => {
    try {
      // hapus kunci yang sudah habis. n = jumlah yang dihapus. 
      const n = svc.purgeExpired();
      // menampilkan pesan hanya kalau ada yang dihapus.
      if (n > 0) console.log(`[cleaner] ${n} lock kedaluwarsa dilepas`);
    } catch (e) {
      // kalau gagal, tampilkan pesan error. aplikasi tetap berjalan.
      console.error('[cleaner] gagal:', e.message);
    }
  }, intervalMs);

  // ini supaya proses ini tidak menahan aplikasi saat aplikasi dimatikan
  timer.unref(); 

  // kembalikan timer supaya bisa dihentikan kalau perlu
  return timer;
};
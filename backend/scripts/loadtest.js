// Load test: 50 user mengunci kursi yang sama secara bersamaan,
// ke aplikasi yang lagi berjalan. Hasil yang benar: hanya 1 yang berhasil.

// Cara pakai:
//   terminal 1: npm run dev
//   terminal 2: npm run loadtest
// Hasil yang diharapkan: { '201': 1, '409': 49 }
//   201 = berhasil, 409 = ditolak karena kursi sudah dikunci.

// Alamat backend yang diuji.
const BASE = process.env.BASE || 'http://localhost:3001/api';

// Jalankan langkah-langkah di bawah secara berurutan.
(async () => {
  // 1. Login 50 user (load1 sampai load50) bersamaan, lalu simpan token masing-masing.
  const tokens = await Promise.all(Array.from({ length: 50 }, (_, i) =>
    fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: `load${i + 1}`, password: 'password123' }),
    })
      .then(r => r.json())
      .then(j => j.accessToken)));

  // 2. Tentukan jadwal yang diuji (default: jadwal id 1).
  const scheduleId = Number(process.argv[2] || 1);

  // 3. Ambil daftar kursi, lalu pilih kursi pertama yang masih kosong.
  const seats = await (await fetch(`${BASE}/schedules/${scheduleId}/seats`)).json();
  const seat = seats.find(s => s.status === 'AVAILABLE');

  // 4. Kirim 50 request kunci kursi yang sama secara bersamaan.
  //    Simpan status HTTP dari setiap request.
  const res = await Promise.all(tokens.map(t => fetch(`${BASE}/locks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    body: JSON.stringify({ scheduleId, seatIds: [seat.id] }),
  }).then(r => r.status)));

  // 5. Hitung jumlah setiap status, lalu tampilkan.
  const tally = res.reduce((a, s) => (a[s] = (a[s] || 0) + 1, a), {});
  console.log(`Kursi ${seat.seat_number}:`, tally);

  // 6. Kalau tepat 1 yang berhasil → lulus (kode 0). Kalau tidak → gagal (kode 1).
  process.exit(tally[201] === 1 ? 0 : 1);
})();

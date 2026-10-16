// Skenario wajib:
//   1. pemesanan berhasil
//   2. gagal karena kursi sudah dikunci user lain
//   3. gagal karena belum login
//   4. kunci kursi otomatis habis setelah 5 menit
// Skenario tambahan:
//   5. kursi yang sudah dipesan tidak bisa dikunci lagi
//   6. token yang sudah habis ditolak
//   7. 50 request bersamaan ke 1 kursi → hanya 1 yang berhasil

const request = require('supertest');
const { openDb } = require('../src/db');
const { seed } = require('../src/seed');
const { createApp } = require('../src/app');

let app, db, clock, scheduleId, seatId;

const login = async (u) => (await request(app).post('/api/auth/login')
  .send({ username: u, password: 'password123' })).body.accessToken;

beforeEach(() => {
  db = openDb(':memory:'); seed(db);
  clock = { t: Date.now(), now() { return this.t; } };
  app = createApp({ db, clock, lockTtlMs: 5 * 60_000, rateLimit: false });
  scheduleId = db.prepare('SELECT id FROM schedules LIMIT 1').get().id;
  seatId = db.prepare('SELECT id FROM seats WHERE schedule_id = ? LIMIT 1').get(scheduleId).id;
});


// pemesanan berhasil //
test('pemesanan sukses', async () => {
  const t = await login('budi');
  
  // kunci kursi harus berhasil
  await request(app).post('/api/locks').set('Authorization', `Bearer ${t}`)
    .send({ scheduleId, seatIds: [seatId] }).expect(201);
  
    // konfirmasi booking, nanti dapat kode bookingnya
    const r = await request(app).post('/api/bookings').set('Authorization', `Bearer ${t}`)
    .send({ scheduleId, seatIds: [seatId] }).expect(201);
    expect(r.body.code).toBeDefined();
  
    // habis di pesan, nanti statusnya booked
    const seats = await request(app).get(`/api/schedules/${scheduleId}/seats`);
  expect(seats.body.find(s => s.id === seatId).status).toBe('BOOKED');
});


// pemesanan gagal, karena kursinya udah dipesan sama yang lain //
test('gagal karena kursi sudah dikunci user lain', async () => {
  
  const a = await login('budi'), b = await login('sari');
  await request(app).post('/api/locks').set('Authorization', `Bearer ${a}`).send({ scheduleId, seatIds: [seatId] }).expect(201);
  
  // pas dicoba pesan kursi yang sama, nanti ketolak
  const r = await request(app).post('/api/locks').set('Authorization', `Bearer ${b}`).send({ scheduleId, seatIds: [seatId] });
  expect(r.status).toBe(409); expect(r.body.error).toBe('SEAT_LOCKED');
});


// gagal pesan karena belom login //
test('gagal karena tidak terautentikasi', async () => {
  await request(app).post('/api/locks').send({ scheduleId, seatIds: [seatId] }).expect(401);
  
  // kalau tokennya ga sesuai nanti ditolak
  const r = await request(app).post('/api/bookings').set('Authorization', 'Bearer token-ngawur')
    .send({ scheduleId, seatIds: [seatId] });
  expect(r.status).toBe(401); expect(r.body.error).toBe('TOKEN_INVALID');
});


// kunci kursi otomatis habis kalau udah lewat 5 menit - ini aku ga terlalu paham cara kerjanya //
test('lock kedaluwarsa otomatis', async () => {
  const a = await login('budi'), b = await login('sari');
  await request(app).post('/api/locks').set('Authorization', `Bearer ${a}`).send({ scheduleId, seatIds: [seatId] }).expect(201);
  clock.t += 5 * 60_000 + 1;                                 // majukan jam > 5 menit
  let seats = await request(app).get(`/api/schedules/${scheduleId}/seats`);
  expect(seats.body.find(s => s.id === seatId).status).toBe('AVAILABLE');
  const c = await request(app).post('/api/bookings').set('Authorization', `Bearer ${a}`).send({ scheduleId, seatIds: [seatId] });
  expect(c.status).toBe(410);                                // A gagal konfirmasi
  await request(app).post('/api/locks').set('Authorization', `Bearer ${b}`).send({ scheduleId, seatIds: [seatId] }).expect(201);
  expect(app.locals.svc.purgeExpired()).toBe(0);
});


// kursi yang udah dipesan ga bisa dipesan lagi //
test('kursi sudah dibooking → 409 SEAT_BOOKED', async () => {
  const a = await login('budi'), b = await login('sari');
  const auth = (t) => ({ Authorization: `Bearer ${t}` });

  await request(app).post('/api/locks').set(auth(a)).send({ scheduleId, seatIds: [seatId] }).expect(201);
  await request(app).post('/api/bookings').set(auth(a)).send({ scheduleId, seatIds: [seatId] }).expect(201);

  const r = await request(app).post('/api/locks').set(auth(b)).send({ scheduleId, seatIds: [seatId] });
  expect(r.status).toBe(409);
  expect(r.body.error).toBe('SEAT_BOOKED');
});


// token yang sudah habis ditolak //
test('token expired → 401 TOKEN_EXPIRED', async () => {
  // Buat token asli yang sudah habis 10 detik lalu.
  const expired = jwt.sign(
    { sub: 1, username: 'budi', exp: Math.floor(Date.now() / 1000) - 10 },
    JWT_SECRET
  );
  // Pakai token tersebut → harus ditolak (401 TOKEN_EXPIRED).
  const r = await request(app).post('/api/locks')
    .set('Authorization', `Bearer ${expired}`)
    .send({ scheduleId, seatIds: [seatId] });
  expect(r.status).toBe(401);
  expect(r.body.error).toBe('TOKEN_EXPIRED');
});


// 50 request bersamaan ke 1 kursi → hanya 1 yang berhasil - ini aku belum coba fiturnya // 
test('50 lock paralel ke 1 kursi → tepat 1 sukses', async () => {
  const tokens = await Promise.all(
    Array.from({ length: 50 }, (_, i) => login(`load${i + 1}`))
  );

  const results = await Promise.all(tokens.map(t =>
    request(app).post('/api/locks')
      .set('Authorization', `Bearer ${t}`)
      .send({ scheduleId, seatIds: [seatId] })
  ));

  const statuses = results.map(r => r.status);
  expect(statuses.filter(s => s === 201)).toHaveLength(1);
  expect(statuses.filter(s => s === 409)).toHaveLength(49);

  const count = db.prepare('SELECT COUNT(*) c FROM seat_locks WHERE seat_id = ?').get(seatId).c;
  expect(count).toBe(1);
}, 30_000);   // batas waktu 30 detik karena ada 50 login
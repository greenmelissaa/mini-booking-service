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

test('pemesanan sukses', async () => {
  const t = await login('budi');
  await request(app).post('/api/locks').set('Authorization', `Bearer ${t}`)
    .send({ scheduleId, seatIds: [seatId] }).expect(201);
  const r = await request(app).post('/api/bookings').set('Authorization', `Bearer ${t}`)
    .send({ scheduleId, seatIds: [seatId] }).expect(201);
  expect(r.body.code).toBeDefined();
  const seats = await request(app).get(`/api/schedules/${scheduleId}/seats`);
  expect(seats.body.find(s => s.id === seatId).status).toBe('BOOKED');
});

test('gagal karena kursi sudah dikunci user lain', async () => {
  const a = await login('budi'), b = await login('sari');
  await request(app).post('/api/locks').set('Authorization', `Bearer ${a}`).send({ scheduleId, seatIds: [seatId] }).expect(201);
  const r = await request(app).post('/api/locks').set('Authorization', `Bearer ${b}`).send({ scheduleId, seatIds: [seatId] });
  expect(r.status).toBe(409); expect(r.body.error).toBe('SEAT_LOCKED');
});

test('gagal karena tidak terautentikasi', async () => {
  await request(app).post('/api/locks').send({ scheduleId, seatIds: [seatId] }).expect(401);
  const r = await request(app).post('/api/bookings').set('Authorization', 'Bearer token-ngawur')
    .send({ scheduleId, seatIds: [seatId] });
  expect(r.status).toBe(401); expect(r.body.error).toBe('TOKEN_INVALID');
});

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
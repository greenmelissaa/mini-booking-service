// semua tabel yang dibutuhin

const Database = require('better-sqlite3');

function openDb(file) {
    const db = new Database(file);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.exec(`
        
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL, name TEXT NOT NULL);

    CREATE TABLE IF NOT EXISTS operators (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL);

    CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY, origin TEXT NOT NULL, destination TEXT NOT NULL,
        UNIQUE(origin, destination));

    CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY,
        route_id INTEGER NOT NULL REFERENCES routes(id),
        operator_id INTEGER NOT NULL REFERENCES operators(id),
        departure_time TEXT NOT NULL,      -- ISO 8601
        arrival_time TEXT NOT NULL,
        price INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_sched_route_dep ON schedules(route_id, departure_time);

    CREATE TABLE IF NOT EXISTS seats (
        id INTEGER PRIMARY KEY,
        schedule_id INTEGER NOT NULL REFERENCES schedules(id),
        seat_number TEXT NOT NULL,
        UNIQUE(schedule_id, seat_number));

    -- 1 kursi hanya boleh punya 1 lock (UNIQUE = penjaga race condition)
    CREATE TABLE IF NOT EXISTS seat_locks (
        id INTEGER PRIMARY KEY,
        seat_id INTEGER NOT NULL UNIQUE REFERENCES seats(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        expires_at INTEGER NOT NULL);      -- epoch ms
    CREATE INDEX IF NOT EXISTS idx_lock_exp ON seat_locks(expires_at);

    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id),
        schedule_id INTEGER NOT NULL REFERENCES schedules(id),
        total_price INTEGER NOT NULL, created_at INTEGER NOT NULL);

    -- 1 kursi hanya bisa dipesan sekali
        CREATE TABLE IF NOT EXISTS booking_seats (
        booking_id INTEGER NOT NULL REFERENCES bookings(id),
        seat_id INTEGER NOT NULL UNIQUE REFERENCES seats(id),
        PRIMARY KEY (booking_id, seat_id));

    CREATE TABLE IF NOT EXISTS refresh_tokens (
        token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
        expires_at INTEGER NOT NULL);
        `);
    return db;
}
module.exports = { openDb };
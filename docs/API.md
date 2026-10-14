# Dokumentasi API — Mini Booking Service

Base URL (lokal): `http://localhost:3001/api`

Semua request dan response memakai JSON. Waktu (`departure_time`, `arrival_time`) dalam format ISO 8601 UTC; `expiresAt` dan `created_at` dalam epoch milidetik.

## Daftar Endpoint

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| POST | `/auth/login` | – | Login, dapatkan access & refresh token |
| POST | `/auth/refresh` | – | Tukar refresh token dengan token baru |
| POST | `/auth/logout` | – | Hapus refresh token |
| GET | `/routes` | – | Daftar rute (asal–tujuan) |
| GET | `/schedules` | – | Cari jadwal berdasarkan rute & tanggal (rate limited) |
| GET | `/schedules/:id` | – | Detail satu jadwal |
| GET | `/schedules/:id/seats` | Opsional | Ketersediaan kursi pada jadwal |
| POST | `/locks` | **Wajib** | Kunci kursi sementara (5 menit) |
| DELETE | `/locks` | **Wajib** | Lepas lock milik sendiri |
| POST | `/bookings` | **Wajib** | Konfirmasi pemesanan sebelum lock kedaluwarsa |
| GET | `/bookings/me` | **Wajib** | Riwayat pemesanan user |

---

## Cara Mendapatkan & Memakai Token

Autentikasi memakai **JWT Bearer token**. Tidak ada registrasi; gunakan akun seed:

| Username | Password |
|---|---|
| `budi` | `password123` |
| `sari` | `password123` |
| `load1` … `load50` | `password123` (untuk load test) |

### 1. Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"budi","password":"password123"}'
```

Response `200`:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "9f2c1a7e4b...",
  "expiresIn": 900,
  "tokenType": "Bearer",
  "user": { "id": 1, "username": "budi", "name": "Budi" }
}
```

- `accessToken` berlaku **15 menit** (`expiresIn` dalam detik).
- `refreshToken` berlaku **7 hari** dan hanya bisa dipakai **sekali** (dirotasi setiap refresh).

### 2. Pakai access token di header

Kirim header `Authorization: Bearer <accessToken>` pada endpoint terproteksi:

```bash
curl -X POST http://localhost:3001/api/locks \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":1,"seatIds":[3]}'
```

### 3. Perbarui token saat kedaluwarsa

Jika mendapat `401` dengan `"error": "TOKEN_EXPIRED"`, tukar refresh token:

```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"9f2c1a7e4b..."}'
```

Response berisi `accessToken` dan `refreshToken` **baru**. Refresh token lama tidak berlaku lagi. Jika refresh token juga tidak valid (`REFRESH_INVALID`), user harus login ulang.

### Contoh di PowerShell (Windows)

```powershell
$r = Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/auth/login `
  -ContentType "application/json" -Body '{"username":"budi","password":"password123"}'
$h = @{ Authorization = "Bearer $($r.accessToken)" }

Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/locks -Headers $h `
  -ContentType "application/json" -Body '{"scheduleId":1,"seatIds":[3]}'
```

---

## Auth

### POST `/auth/login`

Body:

```json
{ "username": "budi", "password": "password123" }
```

| Status | Kondisi |
|---|---|
| 200 | Login berhasil (lihat contoh di atas) |
| 400 `VALIDATION_ERROR` | `username` / `password` kosong |
| 401 `INVALID_CREDENTIALS` | Username atau password salah |

### POST `/auth/refresh`

Body:

```json
{ "refreshToken": "9f2c1a7e4b..." }
```

| Status | Kondisi |
|---|---|
| 200 | Token baru (format sama dengan login) |
| 400 `VALIDATION_ERROR` | `refreshToken` kosong |
| 401 `REFRESH_INVALID` | Refresh token tidak dikenal, sudah dipakai, atau kedaluwarsa |

### POST `/auth/logout`

Body:

```json
{ "refreshToken": "9f2c1a7e4b..." }
```

Response `200`:

```json
{ "message": "Logout berhasil" }
```

---

## Jadwal & Kursi (Publik)

### GET `/routes`

```bash
curl http://localhost:3001/api/routes
```

Response `200`:

```json
[
  { "id": 1, "origin": "Bandung", "destination": "Jakarta" },
  { "id": 3, "origin": "Bandung", "destination": "Bogor" },
  { "id": 2, "origin": "Jakarta", "destination": "Bandung" }
]
```

### GET `/schedules?origin=&destination=&date=`

Cari jadwal berdasarkan rute dan tanggal. `date` berformat `YYYY-MM-DD` dan dihitung sebagai satu hari penuh dalam WIB (UTC+7).

```bash
curl "http://localhost:3001/api/schedules?origin=Bandung&destination=Jakarta&date=2026-10-15"
```

Response `200`:

```json
[
  {
    "id": 4,
    "departure_time": "2026-10-15T00:00:00.000Z",
    "arrival_time": "2026-10-15T03:00:00.000Z",
    "price": 120000,
    "operator": "Primajasa",
    "origin": "Bandung",
    "destination": "Jakarta",
    "available_seats": 18,
    "total_seats": 20
  }
]
```

`available_seats` tidak menghitung kursi yang sudah dipesan atau sedang dikunci (lock yang belum kedaluwarsa).

| Status | Kondisi |
|---|---|
| 200 | Daftar jadwal (bisa array kosong) |
| 400 `VALIDATION_ERROR` | Parameter kosong atau format tanggal salah |
| 429 `RATE_LIMITED` | Lebih dari 30 pencarian per menit per IP |

### GET `/schedules/:id`

```bash
curl http://localhost:3001/api/schedules/4
```

Response `200`:

```json
{
  "id": 4,
  "departure_time": "2026-10-15T00:00:00.000Z",
  "arrival_time": "2026-10-15T03:00:00.000Z",
  "price": 120000,
  "operator": "Primajasa",
  "origin": "Bandung",
  "destination": "Jakarta"
}
```

| Status | Kondisi |
|---|---|
| 404 `SCHEDULE_NOT_FOUND` | Jadwal tidak ada |

### GET `/schedules/:id/seats`

Endpoint publik. Jika request membawa token valid, field `lockedByMe` dan `lockExpiresAt` diisi untuk kursi yang dikunci oleh user tersebut. Identitas pemegang lock lain tidak pernah dikirim.

```bash
curl http://localhost:3001/api/schedules/4/seats \
  -H "Authorization: Bearer eyJhbGciOi..."    # opsional
```

Response `200`:

```json
[
  { "id": 61, "seat_number": "1A", "status": "AVAILABLE", "lockedByMe": false, "lockExpiresAt": null },
  { "id": 62, "seat_number": "1B", "status": "LOCKED",    "lockedByMe": true,  "lockExpiresAt": 1792130400000 },
  { "id": 63, "seat_number": "1C", "status": "LOCKED",    "lockedByMe": false, "lockExpiresAt": null },
  { "id": 64, "seat_number": "1D", "status": "BOOKED",    "lockedByMe": false, "lockExpiresAt": null }
]
```

Nilai `status`: `AVAILABLE`, `LOCKED`, `BOOKED`.

| Status | Kondisi |
|---|---|
| 404 `SCHEDULE_NOT_FOUND` | Jadwal tidak ada |

---

## Lock & Booking (Terproteksi)

Semua endpoint di bagian ini wajib membawa `Authorization: Bearer <accessToken>`. Tanpa token → `401 UNAUTHENTICATED`; token salah → `401 TOKEN_INVALID`; token kedaluwarsa → `401 TOKEN_EXPIRED`.

### POST `/locks`

Kunci satu atau beberapa kursi selama **5 menit**. Bersifat all-or-nothing: jika satu kursi gagal, tidak ada kursi yang dikunci. Mengunci ulang kursi milik sendiri akan memperpanjang lock.

Body:

```json
{ "scheduleId": 4, "seatIds": [61, 62] }
```

```bash
curl -X POST http://localhost:3001/api/locks \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":4,"seatIds":[61,62]}'
```

Response `201`:

```json
{
  "message": "Kursi berhasil dikunci",
  "seatIds": [61, 62],
  "expiresAt": 1792130400000
}
```

| Status | Kondisi |
|---|---|
| 201 | Kursi berhasil dikunci |
| 400 `VALIDATION_ERROR` | `scheduleId` bukan angka, `seatIds` kosong, atau lebih dari 4 kursi |
| 401 `UNAUTHENTICATED` / `TOKEN_INVALID` / `TOKEN_EXPIRED` | Masalah token |
| 404 `SEAT_NOT_FOUND` | Kursi tidak ada pada jadwal tersebut |
| 409 `SEAT_LOCKED` | Kursi sedang dikunci user lain (response menyertakan `seatId`) |
| 409 `SEAT_BOOKED` | Kursi sudah dipesan (response menyertakan `seatId`) |

Contoh response `409`:

```json
{ "error": "SEAT_LOCKED", "message": "Kursi sedang dikunci pengguna lain", "seatId": 61 }
```

### DELETE `/locks`

Melepas lock milik sendiri (misalnya saat user menekan "Batal").

Body:

```json
{ "seatIds": [61, 62] }
```

Response `200`:

```json
{ "message": "Lock dilepas", "released": 2 }
```

### POST `/bookings`

Konfirmasi pemesanan. Hanya berhasil jika user masih memegang lock yang **belum kedaluwarsa** untuk **semua** kursi yang dikirim. Setelah sukses, lock dihapus dan kursi berstatus `BOOKED`.

Body:

```json
{ "scheduleId": 4, "seatIds": [61, 62] }
```

```bash
curl -X POST http://localhost:3001/api/bookings \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":4,"seatIds":[61,62]}'
```

Response `201`:

```json
{
  "message": "Pemesanan berhasil",
  "bookingId": 1,
  "code": "BKMG9XK2A1F3Q",
  "totalPrice": 240000,
  "seatIds": [61, 62]
}
```

| Status | Kondisi |
|---|---|
| 201 | Pemesanan berhasil |
| 400 `VALIDATION_ERROR` | Body tidak lengkap |
| 401 `UNAUTHENTICATED` / `TOKEN_INVALID` / `TOKEN_EXPIRED` | Masalah token |
| 409 `SEAT_BOOKED` | Kursi sudah dipesan |
| 410 `LOCK_EXPIRED` | Lock sudah kedaluwarsa atau bukan milik user ini |

### GET `/bookings/me`

```bash
curl http://localhost:3001/api/bookings/me -H "Authorization: Bearer eyJhbGciOi..."
```

Response `200`:

```json
[
  {
    "id": 1,
    "code": "BKMG9XK2A1F3Q",
    "total_price": 240000,
    "created_at": 1792130100000,
    "departure_time": "2026-10-15T00:00:00.000Z",
    "origin": "Bandung",
    "destination": "Jakarta",
    "operator": "Primajasa",
    "seats": ["1A", "1B"]
  }
]
```

---

## Format Error

Semua error memakai format yang sama:

```json
{ "error": "KODE_ERROR", "message": "Penjelasan untuk manusia" }
```

| HTTP | Kode error | Arti |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Parameter atau body tidak valid |
| 401 | `UNAUTHENTICATED` | Header `Authorization` tidak ada |
| 401 | `TOKEN_INVALID` | Token rusak atau tanda tangan salah |
| 401 | `TOKEN_EXPIRED` | Access token kedaluwarsa → gunakan `/auth/refresh` |
| 401 | `INVALID_CREDENTIALS` | Username atau password salah |
| 401 | `REFRESH_INVALID` | Refresh token tidak valid → login ulang |
| 404 | `SCHEDULE_NOT_FOUND` | Jadwal tidak ditemukan |
| 404 | `SEAT_NOT_FOUND` | Kursi tidak ada pada jadwal |
| 404 | `NOT_FOUND` | Endpoint tidak ada |
| 409 | `SEAT_LOCKED` | Kursi sedang dikunci user lain |
| 409 | `SEAT_BOOKED` | Kursi sudah dipesan |
| 410 | `LOCK_EXPIRED` | Lock kedaluwarsa sebelum konfirmasi |
| 429 | `RATE_LIMITED` | Terlalu banyak pencarian jadwal |
| 500 | `INTERNAL` | Kesalahan server |

---

## Alur Lengkap (Contoh)

1. `POST /auth/login` → simpan `accessToken`.
2. `GET /schedules?origin=Bandung&destination=Jakarta&date=2026-10-15` → pilih `id` jadwal.
3. `GET /schedules/:id/seats` → pilih kursi berstatus `AVAILABLE`.
4. `POST /locks` → kursi terkunci 5 menit (`expiresAt`).
5. `POST /bookings` sebelum `expiresAt` → dapatkan `code` booking.

Postman collection tersedia di `docs/mini-booking-service.postman_collection.json`. Request **Login** otomatis menyimpan token ke variabel collection, sehingga request terproteksi bisa langsung dijalankan.

const MESSAGES: Record<string, string> = {
  SEAT_LOCKED: 'Kursi sedang dikunci pengguna lain.',
  SEAT_BOOKED: 'Kursi sudah dipesan.',
  LOCK_EXPIRED: 'Waktu kunci 5 menit sudah habis. Silakan pilih kursi lagi.',
  TOKEN_INVALID: 'Sesi tidak valid, silakan login ulang.',
  TOKEN_EXPIRED: 'Sesi kedaluwarsa, silakan login ulang.',
  REFRESH_INVALID: 'Sesi kedaluwarsa, silakan login ulang.',
  UNAUTHENTICATED: 'Anda belum login.',
  INVALID_CREDENTIALS: 'Username atau password salah.',
  RATE_LIMITED: 'Terlalu banyak pencarian. Tunggu sekitar 1 menit lalu coba lagi.',
  VALIDATION_ERROR: 'Data yang dikirim tidak valid.',
  SCHEDULE_NOT_FOUND: 'Jadwal tidak ditemukan.',
  NETWORK: 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.',
}

export function errorMessage(e: any) {
  const status: number | undefined = e?.status ?? e?.statusCode ?? e?.response?.status
  const code: string = e?.data?.error ?? (status ? `HTTP_${status}` : 'NETWORK')
  const message = MESSAGES[code] ?? e?.data?.message ?? 'Terjadi kesalahan, coba lagi.'
  return { status, code, message }
}

export function isAuthError(code: string) {
  return ['TOKEN_INVALID', 'TOKEN_EXPIRED', 'REFRESH_INVALID', 'UNAUTHENTICATED'].includes(code)
}
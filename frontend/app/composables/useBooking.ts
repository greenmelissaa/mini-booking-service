// untuk simpan data pesanan pas user pindah halaman

// data kursi yang dipilih: id, nomor kursi
export type SeatPick = { id: number; seat_number: string }

// data pesanan habis kursi dipesan
export type BookingDraft = {
  schedule: any            // detail jadwal (operator, rute, waktu, harga)
  seats: SeatPick[]        // kursi yang dipesan
  expiresAt: number        // countdown pesanan kursi
}

// gagal atai berhasil pesan
export type BookingResult =
  | { success: true; booking: any; schedule: any; seats: SeatPick[] }
  | { success: false; code: string; message: string; scheduleId?: number }

  // data pesanan
export const useBooking = () => useState<BookingDraft | null>('booking', () => null)

// hasil pesanan
export const useBookingResult = () => useState<BookingResult | null>('bookingResult', () => null)
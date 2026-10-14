export type SeatPick = { id: number; seat_number: string }

export type BookingDraft = {
  schedule: any            // detail jadwal (operator, rute, waktu, harga)
  seats: SeatPick[]
  expiresAt: number        // epoch ms dari backend
}

export type BookingResult =
  | { success: true; booking: any; schedule: any; seats: SeatPick[] }
  | { success: false; code: string; message: string; scheduleId?: number }

export const useBooking = () => useState<BookingDraft | null>('booking', () => null)
export const useBookingResult = () => useState<BookingResult | null>('bookingResult', () => null)
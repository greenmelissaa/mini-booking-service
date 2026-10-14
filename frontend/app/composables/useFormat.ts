const TZ = 'Asia/Jakarta'

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) + ' WIB'
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
}

export function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

export function todayWIB() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })   // format YYYY-MM-DD
}
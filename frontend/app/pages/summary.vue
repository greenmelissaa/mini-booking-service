<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const booking = useBooking()
const result = useBookingResult()
const { call } = useApi()

if (!booking.value) await navigateTo('/')

const now = ref(Date.now())
const holdTotal = ref(1)
const confirming = ref(false)
const cancelling = ref(false)
const done = ref(false)
const errorMsg = ref('')
let timer: ReturnType<typeof setInterval> | undefined

const remainingMs = computed(() => (booking.value ? booking.value.expiresAt - now.value : 0))
const expired = computed(() => remainingMs.value <= 0)
const total = computed(() => (booking.value ? booking.value.schedule.price * booking.value.seats.length : 0))

const RADIUS = 52
const CIRC = 2 * Math.PI * RADIUS
const ringOffset = computed(() => {
  const fraction = Math.max(0, Math.min(1, remainingMs.value / holdTotal.value))
  return CIRC * (1 - fraction)
})
const urgent = computed(() => remainingMs.value < 60_000)

onMounted(() => {
  holdTotal.value = Math.max(remainingMs.value, 1)
  timer = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => clearInterval(timer))

function departureDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

watch(expired, (isExpired) => {
  if (isExpired && booking.value && !done.value && !confirming.value) {
    done.value = true
    result.value = {
      success: false,
      code: 'LOCK_EXPIRED',
      message: errorMessage({ data: { error: 'LOCK_EXPIRED' } }).message,
      scheduleId: booking.value.schedule.id,
    }
    booking.value = null
    navigateTo('/result')
  }
})

async function confirm() {
  if (!booking.value || expired.value) return
  const draft = booking.value
  confirming.value = true
  errorMsg.value = ''
  try {
    const r = await call('/bookings', {
      method: 'POST',
      body: { scheduleId: draft.schedule.id, seatIds: draft.seats.map(s => s.id) },
    })
    result.value = { success: true, booking: r, schedule: draft.schedule, seats: draft.seats }
  } catch (e) {
    const err = errorMessage(e)
    result.value = { success: false, code: err.code, message: err.message, scheduleId: draft.schedule.id }
  } finally {
    done.value = true
    booking.value = null
    confirming.value = false
  }
  await navigateTo('/result')
}

async function cancel() {
  if (!booking.value) return
  const draft = booking.value
  cancelling.value = true
  try {
    await call('/locks', { method: 'DELETE', body: { seatIds: draft.seats.map(s => s.id) } })
  } catch (_) {}
  done.value = true
  booking.value = null
  cancelling.value = false
  await navigateTo(`/schedules/${draft.schedule.id}`)
}
</script>

<template>
  <div v-if="booking" class="wrap page narrow">
    <h1 class="page-title">Periksa pesananmu</h1>
    <p class="muted lead">Kursi sudah ditahan untukmu. Konfirmasi sebelum waktunya habis.</p>

    <div v-if="errorMsg" class="notice notice-error" role="alert">{{ errorMsg }}</div>

    <article class="ticket">
      <div class="ticket-main">
        <p class="operator">{{ booking.schedule.operator }}</p>
        <div class="leg">
          <div class="leg-point">
            <span class="leg-time">{{ formatTime(booking.schedule.departure_time) }}</span>
            <span class="leg-city">{{ booking.schedule.origin }}</span>
          </div>
          <div class="leg-line" />
          <div class="leg-point">
            <span class="leg-time">{{ formatTime(booking.schedule.arrival_time) }}</span>
            <span class="leg-city">{{ booking.schedule.destination }}</span>
          </div>
        </div>

        <dl class="facts">
          <dt>Tanggal</dt>
          <dd>{{ departureDate(booking.schedule.departure_time) }}</dd>
          <dt>Kursi</dt>
          <dd><span v-for="s in booking.seats" :key="s.id" class="seat-tag">{{ s.seat_number }}</span></dd>
          <dt>Harga</dt>
          <dd>{{ formatRupiah(booking.schedule.price) }} × {{ booking.seats.length }} kursi</dd>
        </dl>
      </div>

      <div class="ticket-stub hold">
        <div class="ring" :class="{ urgent }" role="timer" :aria-label="`Sisa waktu ${formatCountdown(remainingMs)}`">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" :r="RADIUS" class="ring-track" />
            <circle cx="60" cy="60" :r="RADIUS" class="ring-bar"
                    :stroke-dasharray="CIRC" :stroke-dashoffset="ringOffset" />
          </svg>
          <div class="ring-text">
            <b>{{ formatCountdown(remainingMs) }}</b>
            <span>tersisa</span>
          </div>
        </div>

        <div class="total">
          <span class="muted">Total</span>
          <b>{{ formatRupiah(total) }}</b>
        </div>
      </div>
    </article>

    <div class="actions">
      <button class="btn btn-danger-outline" :disabled="confirming || cancelling" @click="cancel">
        <span v-if="cancelling" class="spinner" aria-hidden="true" />
        {{ cancelling ? 'Membatalkan...' : 'Batalkan & pilih ulang' }}
      </button>
      <button class="btn btn-primary" :disabled="confirming || cancelling || expired" @click="confirm">
        <span v-if="confirming" class="spinner" aria-hidden="true" />
        {{ confirming ? 'Memproses pemesanan...' : 'Konfirmasi pemesanan' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.operator { font-weight: 600; color: var(--green-700); margin-bottom: 14px; }
.hold { align-items: center; text-align: center; gap: 18px; }

.ring { position: relative; width: 140px; height: 140px; }
.ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.ring-track { fill: none; stroke: var(--green-100); stroke-width: 9; }
.ring-bar {
  fill: none; stroke: var(--green-700); stroke-width: 9; stroke-linecap: round;
  transition: stroke-dashoffset 1s linear, stroke .3s;
}
.ring.urgent .ring-bar { stroke: var(--signal); }
.ring-text { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ring-text b { font-family: var(--font-display); font-size: 34px; line-height: 1; }
.ring-text span { font-size: 13px; color: var(--muted); }
.ring.urgent .ring-text b { color: #8A6400; }

.total { display: flex; flex-direction: column; }
.total b { font-family: var(--font-display); font-size: 30px; line-height: 1.1; }

.actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; flex-wrap: wrap; }

@media (max-width: 680px) {
  .hold { flex-direction: row; justify-content: space-between; text-align: left; }
  .ring { width: 110px; height: 110px; }
  .ring-text b { font-size: 26px; }
  .actions { flex-direction: column-reverse; }
  .actions .btn { width: 100%; }
}
</style>
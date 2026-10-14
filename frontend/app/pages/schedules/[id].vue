<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const scheduleId = Number(route.params.id)
const { call } = useApi()
const booking = useBooking()
const result = useBookingResult()

const MAX_SEATS = 4
const schedule = ref<any>(null)
const seats = ref<any[]>([])
const selected = ref<number[]>([])
const loading = ref(true)
const locking = ref(false)
const errorMsg = ref('')
let firstLoad = true
let timer: ReturnType<typeof setInterval> | undefined

async function loadSeats() {
  try {
    seats.value = await call(`/schedules/${scheduleId}/seats`)
    if (firstLoad) {
      selected.value = seats.value.filter(s => s.lockedByMe).map(s => s.id)
      firstLoad = false
    }
    selected.value = selected.value.filter(id => {
      const s = seats.value.find(x => x.id === id)
      return s && (s.status === 'AVAILABLE' || s.lockedByMe)
    })
  } catch (e) {
    errorMsg.value = errorMessage(e).message
  }
}

onMounted(async () => {
  try {
    schedule.value = await call(`/schedules/${scheduleId}`)
    await loadSeats()
  } catch (e) {
    errorMsg.value = errorMessage(e).message
  } finally {
    loading.value = false
  }
  timer = setInterval(loadSeats, 5000)
})
onBeforeUnmount(() => clearInterval(timer))

const rows = computed(() => {
  const map = new Map<string, any[]>()
  for (const s of seats.value) {
    const row = s.seat_number.match(/^\d+/)?.[0] ?? '?'
    if (!map.has(row)) map.set(row, [])
    map.get(row)!.push(s)
  }
  return [...map.entries()].map(([row, list]) => ({
    row,
    left: list.filter(s => /[AB]$/.test(s.seat_number)),
    right: list.filter(s => /[CD]$/.test(s.seat_number)),
  }))
})

const counts = computed(() => ({
  available: seats.value.filter(s => s.status === 'AVAILABLE').length,
  locked: seats.value.filter(s => s.status === 'LOCKED' && !s.lockedByMe).length,
  booked: seats.value.filter(s => s.status === 'BOOKED').length,
}))

const isClickable = (s: any) => s.status === 'AVAILABLE' || s.lockedByMe

function seatClass(s: any) {
  if (selected.value.includes(s.id)) return 'seat-selected'
  if (s.status === 'BOOKED') return 'seat-booked'
  if (s.status === 'LOCKED' && !s.lockedByMe) return 'seat-locked'
  return 'seat-available'
}

function seatTitle(s: any) {
  if (s.status === 'BOOKED') return `Kursi ${s.seat_number}, sudah dipesan`
  if (s.status === 'LOCKED' && !s.lockedByMe) return `Kursi ${s.seat_number}, sedang dikunci pengguna lain`
  if (selected.value.includes(s.id)) return `Kursi ${s.seat_number}, dipilih`
  return `Kursi ${s.seat_number}, tersedia`
}

function toggle(s: any) {
  if (!isClickable(s) || locking.value) return
  errorMsg.value = ''
  if (selected.value.includes(s.id)) {
    selected.value = selected.value.filter(id => id !== s.id)
  } else if (selected.value.length >= MAX_SEATS) {
    errorMsg.value = `Maksimal ${MAX_SEATS} kursi per pemesanan.`
  } else {
    selected.value = [...selected.value, s.id]
  }
}

const selectedSeats = computed(() => seats.value.filter(s => selected.value.includes(s.id)))

async function lockAndContinue() {
  if (!selected.value.length) return
  locking.value = true
  errorMsg.value = ''
  try {
    const r: any = await call('/locks', {
      method: 'POST',
      body: { scheduleId, seatIds: selected.value },
    })
    booking.value = {
      schedule: schedule.value,
      seats: selectedSeats.value.map(s => ({ id: s.id, seat_number: s.seat_number })),
      expiresAt: r.expiresAt,
    }
    await navigateTo('/summary')
  } catch (e: any) {
    const err = errorMessage(e)
    if (isAuthError(err.code)) {
      result.value = { success: false, code: err.code, message: err.message, scheduleId }
      return navigateTo('/result')
    }
    if (err.code === 'SEAT_LOCKED' || err.code === 'SEAT_BOOKED') {
      const seat = seats.value.find(s => s.id === e?.data?.seatId)
      const action = err.code === 'SEAT_BOOKED' ? 'dipesan' : 'dikunci'
      errorMsg.value = seat
        ? `Kursi ${seat.seat_number} baru saja ${action} pengguna lain. Pilih kursi lain.`
        : err.message
      if (seat) selected.value = selected.value.filter(id => id !== seat.id)
      await loadSeats()
    } else {
      errorMsg.value = err.message
    }
  } finally {
    locking.value = false
  }
}
</script>

<template>
  <div class="wrap page">
    <NuxtLink to="/" class="back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      Kembali ke hasil pencarian
    </NuxtLink>

    <div v-if="loading" class="seat-layout">
      <div class="skeleton" style="height: 560px; max-width: 380px; width: 100%; margin: 0 auto" />
      <div class="skeleton" style="height: 320px" />
    </div>

    <div v-else-if="!schedule" class="notice notice-error" role="alert">{{ errorMsg || 'Jadwal tidak ditemukan.' }}</div>

    <template v-else>
      <header class="trip-head">
        <div>
          <h1>{{ schedule.origin }} ke {{ schedule.destination }}</h1>
          <p class="muted">{{ schedule.operator }}, berangkat {{ formatDateTime(schedule.departure_time) }}</p>
        </div>
        <p class="trip-price">{{ formatRupiah(schedule.price) }} <small>per kursi</small></p>
      </header>

      <div v-if="errorMsg" class="notice notice-error" role="alert">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></svg>
        <span>{{ errorMsg }}</span>
      </div>

      <div class="seat-layout">
        <section class="bus" aria-label="Denah kursi bus">
          <div class="bus-front">
            <span class="driver">
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.2" />
                <path d="M12 3v6.8M4.2 15.5l5.8-2.4M19.8 15.5L14 13.1" />
              </svg>
              Sopir
            </span>
            <span class="door">Pintu masuk</span>
          </div>

          <div class="seat-grid">
            <template v-for="r in rows" :key="r.row">
              <button v-for="s in r.left" :key="s.id" type="button" class="seat" :class="seatClass(s)"
                      :disabled="!isClickable(s) || locking" :aria-pressed="selected.includes(s.id)"
                      :aria-label="seatTitle(s)" :title="seatTitle(s)" @click="toggle(s)">
                {{ s.seat_number }}
              </button>
              <span class="row-no" aria-hidden="true">{{ r.row }}</span>
              <button v-for="s in r.right" :key="s.id" type="button" class="seat" :class="seatClass(s)"
                      :disabled="!isClickable(s) || locking" :aria-pressed="selected.includes(s.id)"
                      :aria-label="seatTitle(s)" :title="seatTitle(s)" @click="toggle(s)">
                {{ s.seat_number }}
              </button>
            </template>
          </div>

          <div class="bus-rear">Bagian belakang</div>
        </section>

        <aside class="panel">
          <section class="panel-block">
            <h2>Kursi pilihanmu</h2>
            <p v-if="!selectedSeats.length" class="muted pick-hint">
              Ketuk kursi hijau di denah untuk memilih. Maksimal {{ MAX_SEATS }} kursi.
            </p>
            <template v-else>
              <div class="picked">
                <span v-for="s in selectedSeats" :key="s.id" class="seat-tag">{{ s.seat_number }}</span>
              </div>
              <dl class="sum">
                <dt>{{ selectedSeats.length }} × {{ formatRupiah(schedule.price) }}</dt>
                <dd>{{ formatRupiah(schedule.price * selectedSeats.length) }}</dd>
              </dl>
            </template>

            <button class="btn btn-primary btn-block" :disabled="!selected.length || locking" @click="lockAndContinue">
              <span v-if="locking" class="spinner" aria-hidden="true" />
              {{ locking ? 'Mengunci kursi...' : 'Kunci kursi & lanjut' }}
            </button>
            <p class="muted note">Setelah dikunci, kursi ditahan untukmu selama 5 menit.</p>
          </section>

          <section class="panel-block">
            <h3>Arti warna</h3>
            <ul class="legend">
              <li><span class="swatch seat-available" /> Tersedia <b>{{ counts.available }}</b></li>
              <li><span class="swatch seat-selected" /> Pilihanmu <b>{{ selectedSeats.length }}</b></li>
              <li><span class="swatch seat-locked" /> Ditahan pengguna lain <b>{{ counts.locked }}</b></li>
              <li><span class="swatch seat-booked" /> Sudah dipesan <b>{{ counts.booked }}</b></li>
            </ul>
            <p class="live"><span class="pulse" aria-hidden="true" /> Status kursi diperbarui setiap 5 detik</p>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.trip-head {
  display: flex; justify-content: space-between; align-items: flex-end;
  gap: 16px; flex-wrap: wrap; margin-bottom: 24px;
}
.trip-head h1 { font-size: 42px; margin-bottom: 4px; }
.trip-price { font-family: var(--font-display); font-size: 28px; font-weight: 700; }
.trip-price small { font-family: var(--font-body); font-size: 14px; font-weight: 500; color: var(--muted); }

.seat-layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 32px; align-items: start; }

.bus {
  width: 100%; max-width: 380px; margin: 0 auto;
  background: var(--surface); border: 3px solid var(--green-900);
  border-radius: 72px 72px 24px 24px; padding: 30px 26px 20px;
}
.bus-front {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 18px; margin-bottom: 20px; border-bottom: 2px solid var(--line);
}
.driver { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 14px; font-weight: 600; }
.door {
  font-size: 13px; font-weight: 600; color: var(--green-700);
  border: 1.5px solid var(--green-100); background: var(--green-100);
  border-radius: 999px; padding: 3px 12px;
}

.seat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) 36px repeat(2, minmax(0, 1fr));
  gap: 12px 10px;
  background: repeating-linear-gradient(180deg, var(--signal-soft) 0 14px, transparent 14px 26px) center / 4px 100% no-repeat;
}
.row-no {
  align-self: center; justify-self: center; min-width: 26px; text-align: center;
  font-size: 13px; font-weight: 700; color: var(--muted);
  background: var(--surface); border-radius: 4px; padding: 2px 0;
}

.seat {
  position: relative; height: 56px;
  border-radius: 12px 12px 7px 7px; border: 2px solid;
  font-family: var(--font-display); font-size: 18px; font-weight: 700;
  cursor: pointer; transition: transform .12s ease, background-color .15s;
}
.seat::after {
  content: ""; position: absolute; left: 9px; right: 9px; bottom: 6px;
  height: 4px; border-radius: 2px; background: currentColor; opacity: .3;
}
.seat:disabled { cursor: not-allowed; }

.seat-available { background: #E4F2EB; border-color: #3D9970; color: #145C3B; }
.seat-available:hover:not(:disabled) { background: #CDE9DA; }
.seat-selected { background: var(--signal); border-color: #C99400; color: var(--green-900); }
button.seat-selected { transform: translateY(-3px); box-shadow: 0 4px 0 #C99400; }
.seat-locked {
  background: repeating-linear-gradient(-45deg, #F7DED8 0 6px, #EDC2B8 6px 12px);
  border-color: #C76A57; color: #7A2E20;
}
.seat-booked { background: #E3E7E5; border-color: #C9D0CD; color: #8D9794; }

.bus-rear {
  margin-top: 20px; padding-top: 12px; border-top: 2px solid var(--line);
  text-align: center; font-size: 13px; color: var(--muted);
}

.panel { position: sticky; top: 20px; display: flex; flex-direction: column; gap: 16px; }
.panel-block { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: 22px; }
.panel-block h2 { font-size: 26px; margin-bottom: 12px; }
.panel-block h3 { font-size: 20px; margin-bottom: 12px; }

.pick-hint { margin-bottom: 16px; }
.picked { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.sum {
  display: flex; justify-content: space-between; align-items: baseline;
  margin: 0 0 16px; padding-top: 12px; border-top: 1px solid var(--line);
}
.sum dt { color: var(--muted); }
.sum dd { margin: 0; font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.note { font-size: 14px; margin-top: 10px; }

.legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.legend li { display: flex; align-items: center; gap: 10px; font-size: 15px; }
.legend b { margin-left: auto; font-weight: 600; color: var(--muted); }
.swatch { width: 26px; height: 22px; border-radius: 6px 6px 4px 4px; border: 2px solid; flex: none; }

.live { display: flex; align-items: center; gap: 8px; margin-top: 16px; font-size: 13px; color: var(--muted); }
.pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .3; } }

@media (max-width: 860px) {
  .seat-layout { grid-template-columns: 1fr; }
  .panel { position: static; }
  .trip-head h1 { font-size: 32px; }
}
@media (max-width: 420px) {
  .bus { padding: 24px 14px 16px; border-radius: 56px 56px 20px 20px; }
  .seat { height: 50px; font-size: 16px; }
}
</style>
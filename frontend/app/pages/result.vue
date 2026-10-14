<script setup lang="ts">
const result = useBookingResult()
const auth = useAuth()

if (!result.value) await navigateTo('/')

const needLogin = computed(() => !!result.value && !result.value.success && isAuthError(result.value.code))

const titles: Record<string, string> = {
  SEAT_LOCKED: 'Kursi sedang ditahan pengguna lain',
  SEAT_BOOKED: 'Kursi sudah dipesan orang lain',
  LOCK_EXPIRED: 'Waktu tahan kursi sudah habis',
  TOKEN_INVALID: 'Sesi login tidak valid',
  TOKEN_EXPIRED: 'Sesi login kedaluwarsa',
  REFRESH_INVALID: 'Sesi login kedaluwarsa',
  UNAUTHENTICATED: 'Kamu belum masuk',
}

function departureDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

async function loginAgain() {
  auth.clear()
  await navigateTo('/login')
}
</script>

<template>
  <div v-if="result" class="wrap page narrow">
    <template v-if="result.success">
      <h1 class="page-title">Tiketmu sudah dipesan</h1>
      <p class="muted lead">Simpan kode booking ini dan tunjukkan ke petugas saat naik bus.</p>

      <article class="ticket">
        <div class="ticket-main">
          <p class="operator">{{ result.schedule.operator }}</p>
          <div class="leg">
            <div class="leg-point">
              <span class="leg-time">{{ formatTime(result.schedule.departure_time) }}</span>
              <span class="leg-city">{{ result.schedule.origin }}</span>
            </div>
            <div class="leg-line" />
            <div class="leg-point">
              <span class="leg-time">{{ formatTime(result.schedule.arrival_time) }}</span>
              <span class="leg-city">{{ result.schedule.destination }}</span>
            </div>
          </div>

          <dl class="facts">
            <dt>Tanggal</dt>
            <dd>{{ departureDate(result.schedule.departure_time) }}</dd>
            <dt>Kursi</dt>
            <dd><span v-for="s in result.seats" :key="s.id" class="seat-tag">{{ s.seat_number }}</span></dd>
            <dt>Total</dt>
            <dd>{{ formatRupiah(result.booking.totalPrice) }}</dd>
          </dl>
        </div>

        <div class="ticket-stub code-stub">
          <span class="muted">Kode booking</span>
          <b class="code">{{ result.booking.code }}</b>
          <span class="stamp" aria-hidden="true">Terkonfirmasi</span>
        </div>
      </article>

      <div class="actions">
        <NuxtLink to="/" class="btn btn-primary">Pesan tiket lain</NuxtLink>
      </div>
    </template>

    <template v-else>
      <section class="fail" role="alert">
        <div class="fail-icon" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"
               stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </div>
        <div>
          <p class="fail-kicker">Pemesanan gagal</p>
          <h1>{{ titles[result.code] ?? 'Terjadi kesalahan' }}</h1>
          <p class="fail-msg">{{ result.message }}</p>
          <p class="muted fail-code">Kode error: {{ result.code }}</p>

          <div class="actions start">
            <button v-if="needLogin" class="btn btn-primary" @click="loginAgain">Masuk lagi</button>
            <NuxtLink v-else-if="result.scheduleId" :to="`/schedules/${result.scheduleId}`" class="btn btn-primary">
              Pilih kursi lagi
            </NuxtLink>
            <NuxtLink to="/" class="btn btn-outline">Cari jadwal lain</NuxtLink>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.operator { font-weight: 600; color: var(--green-700); margin-bottom: 14px; }

.code-stub { position: relative; align-items: flex-start; gap: 4px; overflow: hidden; }
.code {
  font-family: var(--font-display); font-size: 30px; letter-spacing: .06em;
  color: var(--green-900); word-break: break-all; line-height: 1.1;
}
.stamp {
  margin-top: 18px; display: inline-block; padding: 6px 14px;
  border: 3px solid var(--ok); border-radius: var(--r-sm); color: var(--ok);
  font-family: var(--font-display); font-size: 20px; font-weight: 700;
  transform: rotate(-8deg);
  animation: stamp .45s cubic-bezier(.2, 1.4, .4, 1) .25s both;
}
@keyframes stamp {
  from { opacity: 0; transform: rotate(-8deg) scale(1.8); }
  to { opacity: 1; transform: rotate(-8deg) scale(1); }
}

.actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
.actions.start { justify-content: flex-start; }

.fail {
  display: grid; grid-template-columns: auto 1fr; gap: 22px;
  background: var(--surface); border: 1px solid var(--line);
  border-left: 6px solid var(--danger); border-radius: var(--r-md); padding: 30px;
}
.fail-icon {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--danger-soft); color: var(--danger);
  display: grid; place-items: center;
}
.fail-kicker { font-weight: 600; color: var(--danger); margin-bottom: 4px; }
.fail h1 { font-size: 36px; margin-bottom: 10px; }
.fail-msg { font-size: 17px; max-width: 52ch; }
.fail-code { font-size: 14px; margin-top: 8px; }

@media (max-width: 680px) {
  .fail { grid-template-columns: 1fr; padding: 22px; }
  .fail h1 { font-size: 28px; }
  .actions .btn { flex: 1; }
}
</style>
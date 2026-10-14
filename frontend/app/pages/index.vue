<script setup lang="ts">
type Route = { id: number; origin: string; destination: string }
type Query = { origin: string; destination: string; date: string }

const { call } = useApi()

const routes = ref<Route[]>([])
const search = useState<Query>('search', () => ({ origin: '', destination: '', date: todayWIB() }))
const schedules = useState<any[] | null>('searchResults', () => null)
const lastQuery = useState<Query | null>('lastQuery', () => null)
const loading = ref(false)
const errorMsg = ref('')

const TZ = { timeZone: 'Asia/Jakarta' } as const

const origins = computed(() => [...new Set(routes.value.map(r => r.origin))])
const destinations = computed(() =>
  routes.value.filter(r => r.origin === search.value.origin).map(r => r.destination))
const canSwap = computed(() =>
  routes.value.some(r => r.origin === search.value.destination && r.destination === search.value.origin))

watch(() => search.value.origin, () => {
  if (!destinations.value.includes(search.value.destination)) {
    search.value.destination = destinations.value[0] ?? ''
  }
})

const days = computed(() => Array.from({ length: 7 }, (_, i) => {
  const iso = new Date(Date.now() + 7 * 3600e3 + i * 86400e3).toISOString().slice(0, 10)
  const d = new Date(`${iso}T12:00:00+07:00`)
  return {
    iso,
    label: i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : d.toLocaleDateString('id-ID', { ...TZ, weekday: 'short' }),
    day: d.toLocaleDateString('id-ID', { ...TZ, day: 'numeric', month: 'short' }),
  }
}))

onMounted(async () => {
  try {
    routes.value = await call('/routes')
    if (!search.value.origin && origins.value.length) search.value.origin = origins.value[0]!
  } catch (e) {
    errorMsg.value = errorMessage(e).message
  }
})

function swap() {
  const { origin, destination } = search.value
  search.value.origin = destination
  search.value.destination = origin
}

async function onSearch() {
  if (!search.value.origin || !search.value.destination) return
  errorMsg.value = ''
  loading.value = true
  const q = { ...search.value }
  try {
    schedules.value = await call('/schedules', { query: q })
    lastQuery.value = q
  } catch (e) {
    errorMsg.value = errorMessage(e).message
    schedules.value = null
  } finally {
    loading.value = false
  }
}

function pickDay(iso: string) {
  search.value.date = iso
  onSearch()
}

function duration(s: any) {
  const h = (new Date(s.arrival_time).getTime() - new Date(s.departure_time).getTime()) / 3600e3
  return Number.isInteger(h) ? `${h} jam` : `${h.toFixed(1)} jam`
}

function longDate(iso: string) {
  return new Date(`${iso}T12:00:00+07:00`).toLocaleDateString('id-ID', {
    ...TZ, weekday: 'long', day: 'numeric', month: 'long',
  })
}

const seatPct = (s: any) => `${Math.round((s.available_seats / Math.max(s.total_seats, 1)) * 100)}%`
</script>

<template>
  <div>
    <section class="hero">
      <div class="wrap">
        <h1>Mau ke mana hari ini?</h1>
        <p class="hero-sub">Pilih rute dan tanggal, lalu tentukan sendiri kursimu di dalam bus.</p>

        <form class="route-bar" @submit.prevent="onSearch">
          <div class="field">
            <label for="origin">Dari</label>
            <select id="origin" v-model="search.origin" class="input" :disabled="loading">
              <option v-for="o in origins" :key="o" :value="o">{{ o }}</option>
            </select>
          </div>

          <button type="button" class="swap" :disabled="!canSwap || loading"
                  aria-label="Tukar asal dan tujuan" title="Tukar asal dan tujuan" @click="swap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
            </svg>
          </button>

          <div class="field">
            <label for="destination">Ke</label>
            <select id="destination" v-model="search.destination" class="input" :disabled="loading">
              <option v-for="d in destinations" :key="d" :value="d">{{ d }}</option>
            </select>
          </div>

          <div class="field">
            <label for="date">Tanggal</label>
            <input id="date" v-model="search.date" class="input" type="date" :min="todayWIB()" :disabled="loading" required>
          </div>

          <button class="btn btn-signal submit" :disabled="loading || !search.origin || !search.destination">
            <span v-if="loading" class="spinner" aria-hidden="true" />
            {{ loading ? 'Mencari...' : 'Cari jadwal' }}
          </button>
        </form>

        <div class="day-strip" role="group" aria-label="Pilih tanggal cepat">
          <button v-for="d in days" :key="d.iso" type="button" class="day"
                  :class="{ active: d.iso === search.date }" :aria-pressed="d.iso === search.date"
                  :disabled="loading || !search.origin" @click="pickDay(d.iso)">
            <span>{{ d.label }}</span>
            <b>{{ d.day }}</b>
          </button>
        </div>
      </div>
      <div class="road" aria-hidden="true" />
    </section>

    <section class="wrap results" aria-live="polite">
      <div v-if="errorMsg" class="notice notice-error" role="alert">{{ errorMsg }}</div>

      <div v-if="loading" class="ticket-list">
        <div v-for="n in 3" :key="n" class="skeleton" style="height: 132px" />
      </div>

      <template v-else-if="schedules && lastQuery">
        <header class="results-head">
          <h2>{{ schedules.length }} keberangkatan</h2>
          <p class="muted">{{ lastQuery.origin }} ke {{ lastQuery.destination }}, {{ longDate(lastQuery.date) }}</p>
        </header>

        <div v-if="schedules.length === 0" class="empty">
          <h3>Belum ada keberangkatan di tanggal ini</h3>
          <p class="muted">Pilih tanggal lain di atas, atau tukar arah perjalanan.</p>
        </div>

        <ol v-else class="ticket-list">
          <li v-for="s in schedules" :key="s.id" class="ticket" :class="{ full: s.available_seats === 0 }">
            <div class="ticket-main">
              <div class="leg">
                <div class="leg-point">
                  <span class="leg-time">{{ formatTime(s.departure_time) }}</span>
                  <span class="leg-city">{{ s.origin }}</span>
                </div>
                <div class="leg-line"><span class="leg-dur">{{ duration(s) }}</span></div>
                <div class="leg-point">
                  <span class="leg-time">{{ formatTime(s.arrival_time) }}</span>
                  <span class="leg-city">{{ s.destination }}</span>
                </div>
              </div>
              <p class="operator">{{ s.operator }}</p>
            </div>

            <div class="ticket-stub">
              <p class="price">{{ formatRupiah(s.price) }}<small> per kursi</small></p>
              <div class="meter">
                <div class="meter-bar"><span :style="{ width: seatPct(s) }" :class="{ low: s.available_seats <= 5 }" /></div>
                <span class="meter-text" :class="{ low: s.available_seats <= 5 }">
                  {{ s.available_seats === 0 ? 'Kursi habis' : `${s.available_seats} dari ${s.total_seats} kursi tersisa` }}
                </span>
              </div>
              <NuxtLink v-if="s.available_seats > 0" :to="`/schedules/${s.id}`" class="btn btn-primary btn-block">
                Pilih kursi
              </NuxtLink>
              <button v-else class="btn btn-outline btn-block" disabled>Penuh</button>
            </div>
          </li>
        </ol>
      </template>

      <div v-else-if="!errorMsg" class="empty">
        <h3>Jadwal akan muncul di sini</h3>
        <p class="muted">Pilih rute, lalu ketuk salah satu tanggal atau tekan Cari jadwal.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero { background: var(--green-900); color: #fff; padding-top: 44px; }
.hero h1 { font-size: 60px; margin-bottom: 8px; }
.hero-sub { font-size: 18px; color: rgba(255, 255, 255, .75); margin-bottom: 28px; }

.route-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px minmax(0, 1fr) 190px auto;
  align-items: end; gap: 10px;
  background: var(--surface); color: var(--ink);
  padding: 14px; border-radius: var(--r-lg);
}

.swap {
  width: 44px; height: 48px; display: grid; place-items: center;
  border: 1.5px solid var(--line); border-radius: var(--r-sm);
  background: var(--surface); color: var(--green-700); cursor: pointer;
}
.swap:hover:not(:disabled) { border-color: var(--green-700); }
.swap:disabled { opacity: .4; cursor: not-allowed; }

.submit { height: 48px; padding: 0 26px; }

.day-strip { display: flex; gap: 8px; overflow-x: auto; padding: 18px 0 4px; scrollbar-width: thin; }
.day {
  flex: none; display: flex; flex-direction: column; align-items: flex-start;
  min-width: 92px; padding: 8px 14px; border-radius: var(--r-sm);
  border: 1.5px solid rgba(255, 255, 255, .22); background: transparent; color: #fff;
  cursor: pointer; line-height: 1.2;
}
.day span { font-size: 13px; color: rgba(255, 255, 255, .7); }
.day b { font-family: var(--font-display); font-size: 19px; }
.day:hover:not(:disabled) { border-color: rgba(255, 255, 255, .6); }
.day.active { background: var(--signal); border-color: var(--signal); color: var(--green-900); }
.day.active span { color: var(--green-900); }
.day:disabled { opacity: .5; cursor: not-allowed; }

.road {
  height: 34px; margin-top: 26px;
  background:
    repeating-linear-gradient(90deg, var(--signal) 0 40px, transparent 40px 72px) center / 100% 4px no-repeat,
    #0A2E2A;
}

.results { padding-top: 36px; padding-bottom: 72px; }
.results-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
.results-head h2 { font-size: 32px; }

.ticket-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 18px; }
.operator { margin-top: 14px; font-weight: 600; color: var(--green-700); }

.price { font-family: var(--font-display); font-size: 30px; font-weight: 700; line-height: 1; }
.price small { font-family: var(--font-body); font-size: 14px; font-weight: 500; color: var(--muted); }

.meter { display: flex; flex-direction: column; gap: 6px; }
.meter-bar { height: 6px; border-radius: 3px; background: var(--green-100); overflow: hidden; }
.meter-bar span { display: block; height: 100%; background: var(--green-700); border-radius: 3px; }
.meter-bar span.low { background: var(--signal); }
.meter-text { font-size: 14px; color: var(--muted); }
.meter-text.low { color: #8A6400; font-weight: 600; }

.ticket.full { opacity: .65; }

.empty { text-align: center; padding: 48px 20px; border: 2px dashed var(--line); border-radius: var(--r-md); }
.empty h3 { font-size: 26px; margin-bottom: 6px; }

@media (max-width: 900px) {
  .route-bar { grid-template-columns: minmax(0, 1fr) 44px minmax(0, 1fr); }
  .route-bar .field:nth-of-type(3) { grid-column: 1 / 3; }
  .submit { grid-column: 3; }
}

@media (max-width: 600px) {
  .hero h1 { font-size: 40px; }
  .route-bar { grid-template-columns: 1fr; }
  .route-bar .field:nth-of-type(3), .submit { grid-column: auto; }
  .swap { width: 100%; height: 38px; }
  .swap svg { transform: rotate(90deg); }
}
</style>
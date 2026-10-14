<script setup lang="ts">
const auth = useAuth()
const route = useRoute()

const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

if (auth.isLoggedIn.value) await navigateTo('/')

async function onSubmit() {
  errorMsg.value = ''
  loading.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    await navigateTo((route.query.redirect as string) || '/')
  } catch (e) {
    errorMsg.value = errorMessage(e).message
  } finally {
    loading.value = false
  }
}

function useDemo(name: string) {
  username.value = name
  password.value = 'password123'
  onSubmit()
}
</script>

<template>
  <div class="login">
    <section class="login-art">
      <div class="art-inner">
        <h1>Pilih kursimu sendiri, sebelum orang lain.</h1>
        <p>Kursi yang kamu pilih ditahan selama 5 menit sampai pesananmu dikonfirmasi.</p>

        <svg class="route-art" viewBox="0 0 420 120" role="img" aria-label="Rute Bandung ke Jakarta">
          <path d="M20 90 C 120 90, 140 30, 230 40 S 360 30, 400 30" fill="none"
                stroke="rgba(255,255,255,.18)" stroke-width="16" stroke-linecap="round" />
          <path d="M20 90 C 120 90, 140 30, 230 40 S 360 30, 400 30" fill="none"
                stroke="#F2B705" stroke-width="3" stroke-dasharray="12 10" stroke-linecap="round" />
          <circle cx="20" cy="90" r="8" fill="#F2B705" />
          <circle cx="400" cy="30" r="8" fill="#fff" stroke="#F2B705" stroke-width="4" />
          <text x="20" y="116" fill="#fff" font-size="15" font-family="Barlow, sans-serif" font-weight="600">Bandung</text>
          <text x="400" y="62" fill="#fff" font-size="15" font-family="Barlow, sans-serif" font-weight="600" text-anchor="end">Jakarta</text>
        </svg>
      </div>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <h2>Masuk</h2>
        <p class="muted sub">Masuk untuk mengunci kursi dan menyelesaikan pemesanan.</p>

        <div v-if="errorMsg" class="notice notice-error" role="alert">{{ errorMsg }}</div>

        <form class="form" @submit.prevent="onSubmit">
          <div class="field">
            <label for="username">Username</label>
            <input id="username" v-model="username" class="input" autocomplete="username" :disabled="loading" required>
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" v-model="password" class="input" type="password" autocomplete="current-password"
                   :disabled="loading" required>
          </div>
          <button class="btn btn-primary btn-block" :disabled="loading">
            <span v-if="loading" class="spinner" aria-hidden="true" />
            {{ loading ? 'Memproses...' : 'Masuk' }}
          </button>
        </form>

        <div class="demo">
          <p class="muted">Atau masuk dengan akun demo</p>
          <div class="demo-buttons">
            <button type="button" class="btn btn-outline" :disabled="loading" @click="useDemo('budi')">
              <span class="avatar small" aria-hidden="true">B</span> Budi
            </button>
            <button type="button" class="btn btn-outline" :disabled="loading" @click="useDemo('sari')">
              <span class="avatar small" aria-hidden="true">S</span> Sari
            </button>
          </div>
          <p class="muted hint">Password kedua akun: <b>password123</b>. Pakai dua browser untuk mencoba rebutan kursi.</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login { display: grid; grid-template-columns: 1.1fr 1fr; min-height: calc(100vh - 64px); }

.login-art {
  background: var(--green-900); color: #fff;
  display: flex; align-items: center; padding: 48px 56px;
  border-top: 1px solid rgba(255, 255, 255, .08);
}
.art-inner { max-width: 460px; }
.login-art h1 { font-size: 54px; margin-bottom: 18px; }
.login-art p { font-size: 18px; color: rgba(255, 255, 255, .78); max-width: 38ch; }
.route-art { width: 100%; max-width: 420px; margin-top: 44px; }

.login-panel { display: grid; place-items: center; padding: 40px 20px; }
.login-card { width: 100%; max-width: 400px; }
.login-card h2 { font-size: 36px; margin-bottom: 6px; }
.sub { margin-bottom: 24px; }

.form { display: flex; flex-direction: column; gap: 16px; }
.form .btn { margin-top: 4px; }

.demo { margin-top: 28px; padding-top: 22px; border-top: 1px solid var(--line); }
.demo-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
.avatar.small { width: 24px; height: 24px; font-size: 13px; }
.hint { font-size: 14px; }

@media (max-width: 860px) {
  .login { grid-template-columns: 1fr; min-height: 0; }
  .login-art { padding: 32px 20px; }
  .login-art h1 { font-size: 38px; }
  .route-art { margin-top: 24px; }
}
</style>
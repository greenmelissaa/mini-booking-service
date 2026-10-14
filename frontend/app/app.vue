<script setup lang="ts">
const auth = useAuth()

async function onLogout() {
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <div>
    <header class="navbar">
      <div class="container nav-inner">
        <NuxtLink to="/" class="brand">🚌 Mini Booking Bus</NuxtLink>
        <nav class="nav-right">
          <template v-if="auth.isLoggedIn.value">
            <span class="muted">Halo, {{ auth.user.value?.name }}</span>
            <button class="btn btn-small btn-warn" title="Mengganti token dengan string acak untuk menguji skenario token tidak valid"
                    @click="auth.breakToken()">
              Rusak token (demo)
            </button>
            <button class="btn btn-small btn-ghost" @click="onLogout">Logout</button>
          </template>
          <NuxtLink v-else to="/login" class="btn btn-small btn-primary">Login</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="container page">
      <NuxtPage />
    </main>
  </div>
</template>

<style>
:root {
  --bg: #f5f7fb; --card: #fff; --text: #1f2937; --muted: #6b7280; --border: #e5e7eb;
  --primary: #2563eb; --primary-dark: #1d4ed8; --danger: #dc2626; --success: #16a34a; --warn: #f59e0b;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); }
a { color: var(--primary); text-decoration: none; }

.container { max-width: 880px; margin: 0 auto; padding: 0 16px; }
.page { padding-top: 24px; padding-bottom: 48px; }
.navbar { background: #fff; border-bottom: 1px solid var(--border); }
.nav-inner { display: flex; align-items: center; justify-content: space-between; height: 60px; gap: 12px; }
.brand { font-weight: 700; color: var(--text); }
.nav-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
.muted { color: var(--muted); font-size: 14px; }
h1 { font-size: 24px; margin: 0 0 16px; }
h2 { font-size: 18px; margin: 0 0 12px; }

.form-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: end; }
label { font-size: 14px; font-weight: 600; }
input, select { padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 15px; background: #fff; width: 100%; }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 16px; border-radius: 8px;
  border: 1px solid transparent; font-size: 15px; font-weight: 600; cursor: pointer; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
.btn-ghost { background: #fff; border-color: var(--border); color: var(--text); }
.btn-warn { background: #fff7ed; border-color: #fdba74; color: #9a3412; }
.btn-danger { background: #fff; border-color: #fca5a5; color: var(--danger); }
.btn-small { padding: 6px 10px; font-size: 13px; }
.btn-block { width: 100%; }

.alert { padding: 12px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 14px; }
.alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.alert-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
.alert-warn { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }

.spinner { width: 16px; height: 16px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%;
  display: inline-block; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
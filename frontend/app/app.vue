<script setup lang="ts">
const auth = useAuth()
const tokenBroken = ref(false)

const initial = computed(() =>
  (auth.user.value?.name || auth.user.value?.username || '?').charAt(0).toUpperCase())

function breakToken() {
  auth.breakToken()
  tokenBroken.value = true
  setTimeout(() => (tokenBroken.value = false), 2500)
}

async function onLogout() {
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <div>
    <header class="topbar">
      <div class="wrap topbar-inner">
        <NuxtLink to="/" class="brand">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="4" y="3" width="16" height="15" rx="3" />
            <path d="M4 11h16M8 18v2M16 18v2" />
            <circle cx="8" cy="14.5" r=".9" fill="currentColor" />
            <circle cx="16" cy="14.5" r=".9" fill="currentColor" />
          </svg>
          <span>Mini Booking Bus</span>
        </NuxtLink>

        <nav class="top-actions" aria-label="Akun">
          <template v-if="auth.isLoggedIn.value">
            <span class="user-chip">
              <span class="avatar" aria-hidden="true">{{ initial }}</span>
              <span>{{ auth.user.value?.name }}</span>
            </span>
            <button class="btn btn-sm btn-demo"
                    title="Mengganti token dengan string acak untuk menguji skenario token tidak valid"
                    @click="breakToken">
              {{ tokenBroken ? 'Token dirusak' : 'Rusak token (demo)' }}
            </button>
            <button class="btn btn-sm btn-on-dark" @click="onLogout">Keluar</button>
          </template>
          <NuxtLink v-else to="/login" class="btn btn-sm btn-signal">Masuk</NuxtLink>
        </nav>
      </div>
    </header>

    <NuxtPage />
  </div>
</template>
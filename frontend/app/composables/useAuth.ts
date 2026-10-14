type User = { id: number; username: string; name: string }
type AuthState = { accessToken: string | null; refreshToken: string | null; user: User | null }

const STORAGE_KEY = 'mb_auth'

function loadFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return { accessToken: null, refreshToken: null, user: null }
}

export const useAuth = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const state = useState<AuthState>('auth', loadFromStorage)

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value)) } catch (_) {}
  }

  function setTokens(r: any) {
    state.value = {
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      user: r.user ?? state.value.user,
    }
    save()
  }

  function clear() {
    state.value = { accessToken: null, refreshToken: null, user: null }
    save()
  }

  const isLoggedIn = computed(() => !!state.value.accessToken)
  const user = computed(() => state.value.user)

  async function login(username: string, password: string) {
    const r = await $fetch('/auth/login', {
      baseURL: apiBase, method: 'POST', body: { username, password },
    })
    setTokens(r)
  }

  // Dipanggil oleh useApi saat backend membalas TOKEN_EXPIRED
  async function refreshTokens(): Promise<boolean> {
    if (!state.value.refreshToken) return false
    try {
      const r = await $fetch('/auth/refresh', {
        baseURL: apiBase, method: 'POST', body: { refreshToken: state.value.refreshToken },
      })
      setTokens(r)
      return true
    } catch (_) {
      clear()
      return false
    }
  }

  async function logout() {
    try {
      if (state.value.refreshToken) {
        await $fetch('/auth/logout', {
          baseURL: apiBase, method: 'POST', body: { refreshToken: state.value.refreshToken },
        })
      }
    } catch (_) {}
    clear()
  }

  // Untuk demo skenario "token tidak valid"
  function breakToken() {
    state.value = { ...state.value, accessToken: 'token-rusak.' + Math.random().toString(36).slice(2) }
    save()
  }

  return { state, isLoggedIn, user, login, logout, refreshTokens, clear, breakToken }
}
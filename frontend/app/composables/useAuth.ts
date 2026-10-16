// mengatur login di frontend: simpan token, login, logout
// refresh token, tombol "rusak token (demo)"
// fungsi di folder composables bisa langsung dipake di semua halaman


// data user
type User = { id: number; username: string; name: string }

// data login yang disimpan: access token, refresh token, data user
type AuthState = { accessToken: string | null; refreshToken: string | null; user: User | null }

// nama tempat penyimpanan
const STORAGE_KEY = 'mb_auth'

// supaya user bisa tetap login walaupun halamannya di refresh
function loadFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  // belum ada data login
  return { accessToken: null, refreshToken: null, user: null }
}

export const useAuth = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  
  // data login yang bisa dipake sama sama semua halaman
  // nilai awalnya diambil dari localStorage 
  const state = useState<AuthState>('auth', loadFromStorage)

  // simpan data login
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value)) } catch (_) {}
  }

  // simpan token baru kalau habis login atau refresh
  function setTokens(r: any) {
    state.value = {
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      user: r.user ?? state.value.user,
    }
    save()
  }

  // untuk hapus semua data login
  function clear() {
    state.value = { accessToken: null, refreshToken: null, user: null }
    save()
  }

  // true kalau user udah login (punya token)
  const isLoggedIn = computed(() => !!state.value.accessToken)
  const user = computed(() => state.value.user)

  // login: kirim username sama password ke backend
  async function login(username: string, password: string) {
    const r = await $fetch('/auth/login', {
      baseURL: apiBase, method: 'POST', body: { username, password },
    })
    setTokens(r)
  }

  // Dipanggil oleh useApi saat backend membalas TOKEN_EXPIRED
  // untuk minta token baru (refresh token)
  // dipake otomatis pas access token sudah habis
  // hasilnya true kalau berhasil, false kalau gagal
  async function refreshTokens(): Promise<boolean> {
    if (!state.value.refreshToken) return false // kalau gapunya refresh token
    try {
      const r = await $fetch('/auth/refresh', {
        baseURL: apiBase, method: 'POST', body: { refreshToken: state.value.refreshToken },
      })
      setTokens(r)
      return true
    } catch (_) {
      // kalau refresh token juga ga berlaku, nanti hapus data login, terus user harus login ulang
      clear()
      return false
    }
  }

  // logout: minta backend hapus refresh token, terus nanti data login dihapus
  async function logout() {
    try {
      if (state.value.refreshToken) {
        await $fetch('/auth/logout', {
          baseURL: apiBase, method: 'POST', body: { refreshToken: state.value.refreshToken },
        })
      }
    } catch (_) {}
    // kalau backendnya ga bisa dihubngin, user dikeluarin
    clear()
  }

  // Untuk demo skenario "token tidak valid"
  // supaya request selanjutnya ditolak karna tokennya ga valid
  function breakToken() {
    state.value = { ...state.value, accessToken: 'token-rusak.' + Math.random().toString(36).slice(2) }
    save()
  }

  return { state, isLoggedIn, user, login, logout, refreshTokens, clear, breakToken }
}
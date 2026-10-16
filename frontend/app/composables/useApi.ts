// fungsi untuk mengirim request ke backend
// 1. memakai alamat backend
// 2. menambahkan token login di header
// 3. kalau token udah abis, nanti refresh token terus dikirim ulang

export const useApi = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const auth = useAuth()

  // mengirim request
  // - path  : endpoint tujuan
  // - opts  : pengaturan request (method, body, query, dll)
  // - retry : boleh kirim ulang habis refresh token?... supaya ga ngulang terus
  async function call<T = any>(path: string, opts: any = {}, retry = true): Promise<T> {
    const headers: Record<string, string> = { ...(opts.headers || {}) }
    const token = auth.state.value.accessToken
    if (token) headers.Authorization = `Bearer ${token}`

    try {
      return await $fetch<T>(path, { baseURL: apiBase, ...opts, headers })
    } catch (e: any) {
      
      // ini untuk kalau tokennya udah abis, terus belom pernah dicoba ulang
      if (retry && e?.data?.error === 'TOKEN_EXPIRED') {
        const ok = await auth.refreshTokens()
        if (ok) return call<T>(path, opts, false)
      }
      throw e   // e.data.error berisi kode error dari backend
    }
  }

  return { call }
}
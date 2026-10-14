export const useApi = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const auth = useAuth()

  async function call<T = any>(path: string, opts: any = {}, retry = true): Promise<T> {
    const headers: Record<string, string> = { ...(opts.headers || {}) }
    const token = auth.state.value.accessToken
    if (token) headers.Authorization = `Bearer ${token}`

    try {
      return await $fetch<T>(path, { baseURL: apiBase, ...opts, headers })
    } catch (e: any) {
      if (retry && e?.data?.error === 'TOKEN_EXPIRED') {
        const ok = await auth.refreshTokens()
        if (ok) return call<T>(path, opts, false)
      }
      throw e   // e.data.error berisi kode error dari backend
    }
  }

  return { call }
}
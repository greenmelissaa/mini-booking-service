// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  ssr: false, //membuat aplikasi berjalan sepenuhnya di browser

  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3001/api', // apiBase = alamat backend. nanti semua request frontend mengambil alamat
                                            // dari sini, lewat useRuntimeConfig().public.apiBase.
    },
  },

  app: {
    head: { title: 'Mini Booking Bus'},
  },
})

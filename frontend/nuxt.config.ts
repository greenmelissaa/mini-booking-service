// pengaturan utama aplikasi frontend 

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',   // biarkan tanggal yang sudah ada di file-mu
  devtools: { enabled: true },

  ssr: false,

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3001/api',
    },
  },

  app: {
    head: {
      title: 'Mini Booking Bus',
      htmlAttrs: { lang: 'id' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0E3B36' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },
})
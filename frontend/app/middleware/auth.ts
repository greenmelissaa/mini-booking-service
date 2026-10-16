// dijalankan sebelum membuka halaman kursi dan halaman ringkasan
// kalau misalnya usernya belom login, nanti diarahin ke halaman login
// kalau udah login, user dikembaliin ke halaman yang terakhir diakses


export default defineNuxtRouteMiddleware((to) => {
  const { isLoggedIn } = useAuth()
  
  if (!isLoggedIn.value) {
    // belom login, diarahin ke halaman login
    // redirect menyimpan alamat halaman yang tadi ingin dibuka
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
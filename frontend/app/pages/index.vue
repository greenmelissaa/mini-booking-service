<script setup>
const { public: { apiBase } } = useRuntimeConfig()
const { data: routes, error } = await useFetch(`${apiBase}/routes`)
</script>

<template>
  <main style="padding: 24px; font-family: sans-serif">
    <h1>Mini Booking Bus</h1>
    <p v-if="error" style="color: red">Gagal terhubung ke backend: {{ error.message }}</p>
    <ul v-else>
      <li v-for="r in routes" :key="r.id">{{ r.origin }} → {{ r.destination }}</li>
    </ul>
  </main>
</template>
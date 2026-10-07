<script setup lang="ts">
useHead({ title: 'Inloggen · Projectkaart' })
const route = useRoute()
const { inloggen, melding } = useGebruiker()
const bezig = ref(false)

async function start() {
  bezig.value = true
  await inloggen(typeof route.query.terug === 'string' ? route.query.terug : '/')
  bezig.value = false
}
</script>

<template>
  <main class="login">
    <div class="kaart login-kaart">
      <BbdwLogo class="login-logo" />
      <p class="label">Projectkaart</p>
      <h1>Eén plek voor elk project.</h1>
      <p class="lead">Log in met je BbDW-account. Daarna zie je per project wat klaar is, wat openstaat en wie wat heeft afgetekend.</p>
      <button type="button" class="knop zwart groot" :disabled="bezig" @click="start">{{ bezig ? 'Naar Microsoft…' : 'Inloggen met Microsoft' }}</button>
      <p v-if="melding" class="fout-melding" role="alert">{{ melding }}</p>
    </div>
  </main>
</template>

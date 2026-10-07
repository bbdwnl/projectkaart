<script setup lang="ts">
useHead({ title: 'Inloggen · Projectkaart' })
const route = useRoute()
const { inloggen, melding, modus } = useGebruiker()
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
      <span v-if="modus === 'proef'" class="tab later">Proefversie</span>
      <BbdwLogo class="login-logo" />
      <p class="label">Projectkaart</p>
      <h1>Eén plek voor elk project.</h1>
      <p class="lead">Log in met je BbDW-account. Daarna zie je per project wat klaar is, wat openstaat en wie wat heeft afgetekend.</p>
      <button type="button" class="knop zwart groot" :disabled="bezig" @click="start">
        {{ bezig ? (modus === 'proef' ? 'Binnenkomen…' : 'Naar Microsoft…') : 'Inloggen met Microsoft' }}
      </button>
      <p v-if="modus === 'proef'" class="proef-uitleg">
        Dit is een proefversie om te bekijken en uit te proberen. Inloggen met Microsoft is nog niet gekoppeld: de knop laat je zonder account binnen.
        De projecten en datums komen uit het prototype; statussen, mensen en documenten zijn voorbeeldgegevens. Wat je verandert, blijft alleen in deze browser.
      </p>
      <p v-if="melding" class="fout-melding" role="alert">{{ melding }}</p>
    </div>
  </main>
</template>

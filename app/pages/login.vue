<script setup lang="ts">
useHead({ title: 'Inloggen · Projectkaart' })
const route = useRoute()
const { inloggen, melding, modus, toegang } = useGebruiker()
const bezig = ref(false)
const wachtwoord = ref('')
const metWachtwoord = computed(() => modus.value === 'proef' && !toegang.value)

async function start() {
  if (metWachtwoord.value && !wachtwoord.value) {
    melding.value = 'Vul het wachtwoord van de proefversie in.'
    return
  }
  bezig.value = true
  await inloggen(typeof route.query.terug === 'string' ? route.query.terug : '/', wachtwoord.value)
  bezig.value = false
}
</script>

<template>
  <main class="login">
    <form class="kaart login-kaart" @submit.prevent="start">
      <span v-if="modus === 'proef'" class="tab later">Proefversie</span>
      <BbdwLogo class="login-logo" />
      <p class="label">Projectkaart</p>
      <h1>Eén plek voor elk project.</h1>
      <p class="lead">Log in met je BbDW-account. Daarna zie je per project wat klaar is, wat openstaat en wie wat heeft afgetekend.</p>
      <div v-if="metWachtwoord" class="wachtwoord">
        <label for="wachtwoord">Wachtwoord van de proefversie</label>
        <input id="wachtwoord" v-model="wachtwoord" class="veld" type="password" autocomplete="current-password" required>
      </div>
      <button type="submit" class="knop zwart groot" :disabled="bezig">
        {{ bezig ? (modus === 'proef' ? 'Binnenkomen…' : 'Naar Microsoft…') : 'Inloggen met Microsoft' }}
      </button>
      <p v-if="melding" class="fout-melding" role="alert">{{ melding }}</p>
      <p v-if="modus === 'proef'" class="proef-uitleg">
        Dit is een proefversie om te bekijken en uit te proberen. Inloggen met Microsoft is nog niet gekoppeld: de knop laat je zonder account binnen<template v-if="metWachtwoord">, met het wachtwoord dat je bij de link kreeg</template>.
        De projecten en datums komen uit het prototype; statussen, mensen en documenten zijn voorbeeldgegevens. Wat je verandert, blijft alleen in deze browser.
      </p>
    </form>
  </main>
</template>

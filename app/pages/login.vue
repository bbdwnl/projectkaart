<script setup lang="ts">
import type { EmailOtpType } from '@supabase/supabase-js'
import { veiligPad } from '~/lib/inlog'

// Inloggen met een link per mail: je vult je adres in, krijgt een link, en blijft een week ingelogd. Het scherm zegt
// niet welk domein mag. Na vijf foute adressen op rij gaat het adresveld vijf minuten dicht, ook dat zonder melding.
// De link brengt je hier terug met token_hash. Pas met een klik op Inloggen wordt hij gebruikt: de linkscanner van
// Outlook opent links in de mail vooraf, en zou hem anders opmaken voordat jij erop klikt.
useHead({ title: 'Inloggen · Projectkaart' })
const route = useRoute()
const router = useRouter()
const { gebruiker, stuurLink, metLink, terugNaInloggen, bewaarNaam, naamVoorstel, melding, geblokkeerdTot } = useGebruiker()
const bezig = ref(false)
const email = ref('')
const naam = ref('')
const verstuurd = ref(false)
const tokenHash = computed(() => (typeof route.query.token_hash === 'string' ? route.query.token_hash : ''))
const TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup', 'invite']
const linkType = computed(() => TYPES.find(t => t === route.query.type) ?? 'email')
const stap = computed(() => {
  if (gebruiker.value?.naamNodig) return 'naam'
  if (tokenHash.value) return 'link'
  return verstuurd.value ? 'verstuurd' : 'adres'
})
// Het veld gaat vanzelf weer open als de vijf minuten om zijn.
const nuMs = ref(Date.now())
let openKlok: ReturnType<typeof setTimeout> | undefined
watch(geblokkeerdTot, (tot) => {
  clearTimeout(openKlok)
  nuMs.value = Date.now()
  if (tot > nuMs.value) openKlok = setTimeout(() => { nuMs.value = Date.now() }, tot - nuMs.value + 50)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(openKlok))
const dicht = computed(() => geblokkeerdTot.value > nuMs.value)
const terug = () => (typeof route.query.terug === 'string' ? veiligPad(route.query.terug) : terugNaInloggen())

// Een oude link via Supabase zelf (zonder token_hash) die niet meer werkt, komt terug met een foutmelding.
if (route.query.error_code || route.query.error_description) {
  melding.value = 'Deze inloglink werkt niet meer: hij is al gebruikt of verlopen. Vraag hieronder een nieuwe aan.'
  router.replace({ query: typeof route.query.terug === 'string' ? { terug: route.query.terug } : {} })
}
// Ingelogd in een andere tab (met de link uit de mail): deze tab, die op "Kijk in je mail" wachtte, gaat mee.
watch(() => !!gebruiker.value && !gebruiker.value.naamNodig, (binnen) => {
  if (binnen && stap.value === 'verstuurd') navigateTo(terug())
})
watch(() => gebruiker.value?.naamNodig, (nodig) => {
  if (nodig && !naam.value) naam.value = naamVoorstel.value
}, { immediate: true })

async function verstuur() {
  bezig.value = true
  try {
    if (stap.value === 'naam') {
      if (naam.value.trim().length < 2) {
        melding.value = 'Vul je naam in, minstens twee letters.'
        return
      }
      if (await bewaarNaam(naam.value)) await navigateTo(terug())
    } else if (stap.value === 'link') {
      if (!await metLink(tokenHash.value, linkType.value)) {
        await router.replace({ query: {} })
        return
      }
      if (!gebruiker.value?.naamNodig) await navigateTo(terug())
    } else {
      verstuurd.value = await stuurLink(email.value, typeof route.query.terug === 'string' ? route.query.terug : '/')
    }
  } finally {
    bezig.value = false
  }
}

function anderAdres() {
  verstuurd.value = false
  melding.value = ''
}

const KNOP = { adres: ['Stuur inloglink', 'Versturen…'], verstuurd: ['', ''], link: ['Inloggen', 'Inloggen…'], naam: ['Verder', 'Opslaan…'] } as const
</script>

<template>
  <main class="login">
    <form class="kaart login-kaart" @submit.prevent="verstuur">
      <BbdwLogo class="login-logo" />
      <p class="label">Projectkaart</p>
      <h1>{{ stap === 'naam' ? 'Welkom.' : stap === 'verstuurd' ? 'Kijk in je mail.' : 'Eén plek voor elk project.' }}</h1>

      <template v-if="stap === 'adres'">
        <p class="lead">Vul je e-mailadres in. Je krijgt een link per mail; daarmee blijf je op dit apparaat een week ingelogd.</p>
        <div class="login-veld">
          <label for="email">E-mailadres</label>
          <input id="email" v-model="email" class="veld" type="email" autocomplete="email" inputmode="email" required :disabled="dicht">
        </div>
      </template>
      <template v-else-if="stap === 'verstuurd'">
        <p class="lead">De inloglink staat klaar in <b>{{ email.trim().toLowerCase() }}</b>. Open hem en klik op Inloggen. De link werkt één keer en een uur lang.</p>
        <p class="klein">Niets gekregen? Kijk ook bij ongewenste mail. <button type="button" class="link" @click="anderAdres">Ander adres of opnieuw sturen</button></p>
      </template>
      <template v-else-if="stap === 'link'">
        <p class="lead">Klik op Inloggen. Daarna blijf je op dit apparaat een week ingelogd.</p>
      </template>
      <template v-else>
        <p class="lead">Nog één ding: hoe heet je? Je naam staat bij wat je aftekent en wijzigt, zodat iedereen ziet wie het was. Je kiest hem één keer; daarna past alleen een beheerder hem aan.</p>
        <div class="login-veld">
          <label for="naam">Je naam</label>
          <input id="naam" v-model="naam" class="veld" autocomplete="name" required minlength="2" maxlength="80">
        </div>
      </template>

      <button v-if="stap !== 'verstuurd'" type="submit" class="knop zwart groot" :disabled="bezig || (stap === 'adres' && dicht)">{{ KNOP[stap][bezig ? 1 : 0] }}</button>
      <p v-if="melding" class="fout-melding" role="alert">{{ melding }}</p>
    </form>
  </main>
</template>

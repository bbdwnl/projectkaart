<script setup lang="ts">
import type { Project, Taak, Uitzondering } from '~/lib/types'
import { kaartjesVan, leesSortering, sorteerKaartjes, SORTERINGEN, vindt } from '~/lib/overzicht'
import { vandaag } from '~/lib/datum'

// De projecten in haalbaarheid: na de lead, voor de ontwikkeling. Dezelfde kaartjes als op Projecten.
useHead({ title: 'Haalbaarheid · Projectkaart' })
const bron = useBron()
const { modus } = useGebruiker()
const nu = vandaag()
const stand = ref<'laden' | 'klaar' | 'fout'>('laden')
const fout = ref('')
const projecten = ref<Project[]>([])
const taken = ref<Taak[]>([])
const catalogus = ref<Uitzondering[]>([])
const zoek = ref('')
// De sortering staat in de adresbalk: terug vanaf een kaart geeft dezelfde volgorde.
const route = useRoute()
const router = useRouter()
const sortering = ref(leesSortering(route.query.sort))
watch(sortering, s => router.replace({ query: s === 'telaat' ? {} : { sort: s } }))
watch(() => route.query.sort, (s) => {
  if (route.path === '/haalbaarheid') sortering.value = leesSortering(s)
})
const datumBij = (p: Project) => (sortering.value === 'inkoop' ? { naam: 'Inkoop gereed', waarde: p.datum_inkoop } : null)

async function laad() {
  stand.value = 'laden'
  try {
    ;[projecten.value, taken.value, catalogus.value] = await Promise.all([bron.projecten(), bron.taken(), bron.uitzonderingen()])
    stand.value = 'klaar'
  } catch (e) {
    fout.value = foutTekst(e)
    stand.value = 'fout'
  }
}
onMounted(laad)

const kaartjes = computed(() => sorteerKaartjes(kaartjesVan(projecten.value.filter(p => p.fase === 'haalbaarheid'), taken.value, catalogus.value, nu), sortering.value))
const zichtbaar = computed(() => kaartjes.value.filter(k => vindt(k, zoek.value)))
const zin = computed(() => {
  const n = kaartjes.value.length
  if (!n) return 'Geen projecten in haalbaarheid.'
  const laat = kaartjes.value.filter(k => k.t.telaat).length
  return `${n} ${n === 1 ? 'project' : 'projecten'} in haalbaarheid. ${laat ? `${laat} ${laat === 1 ? 'heeft' : 'hebben'} taken die te laat zijn.` : 'Niets te laat.'}`
})
</script>

<template>
  <main class="wrap">
    <p v-if="modus === 'proef'" class="melding">Proefversie. De projecten en datums komen uit het prototype; statussen, mensen en documenten zijn voorbeeldgegevens. Je wijzigingen blijven alleen in deze browser.</p>
    <header class="paginakop">
      <p class="label">Na de lead, voor de ontwikkeling</p>
      <h1>Haalbaarheid</h1>
      <p v-if="stand === 'klaar'" class="zin">{{ zin }}</p>
    </header>

    <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /><span class="laden-regel" /></div>
    <div v-else-if="stand === 'fout'" class="leeg-staat">{{ fout }} <button type="button" class="link" @click="laad">Probeer het opnieuw</button></div>
    <template v-else-if="kaartjes.length">
      <div class="filters projectfilters">
        <input v-model="zoek" class="veld zoekveld" type="search" placeholder="Zoek op naam, nummer, plaats of persoon" aria-label="Zoek een project">
        <div class="filtergroep">
          <span class="label">Sorteer</span>
          <div class="seg" role="group" aria-label="Sorteer">
            <button v-for="s in SORTERINGEN" :key="s.id" type="button" :aria-pressed="sortering === s.id" @click="sortering = s.id">{{ s.naam }}</button>
          </div>
        </div>
      </div>
      <div class="projectgrid">
        <ProjectKaartje v-for="(k, i) in zichtbaar" :key="k.p.id" :k="k" :volgorde="i" :datum="datumBij(k.p)" />
      </div>
      <p v-if="!zichtbaar.length" class="leeg-staat">Geen project gevonden. Zoek op een deel van de naam of het nummer.</p>
    </template>
    <p v-else class="leeg-staat projectfilters">Nog geen projecten in haalbaarheid. Een lead komt hier zodra je op de kaart de fase op Haalbaarheid zet.</p>
    <footer>Projectkaart BbDW · een project gaat naar Projecten zodra je op de kaart de fase op Ontwikkeling zet.</footer>
  </main>
</template>

<script setup lang="ts">
import type { Project, Taak, Uitzondering } from '~/lib/types'
import { faseInfo, ROLLEN } from '~/lib/fasen'
import { kaartjesVan, KOLOMMEN, leesSortering, sorteerKaartjes, SORTERINGEN, vindt } from '~/lib/overzicht'
import { vandaag } from '~/lib/datum'

// De lopende projecten in drie kolommen: ontwikkeling, uitvoering en nazorg. Per kolom het dringendste bovenaan.
// Leads en haalbaarheid hebben een eigen pagina. Het echte overzicht volgt in fase C.
useHead({ title: 'Projecten · Projectkaart' })
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
  if (route.path === '/') sortering.value = leesSortering(s)
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

const kaartjes = computed(() => sorteerKaartjes(kaartjesVan(projecten.value.filter(p => KOLOMMEN.includes(p.fase)), taken.value, catalogus.value, nu), sortering.value))
const kolommen = computed(() => KOLOMMEN.map((f) => {
  const inFase = kaartjes.value.filter(k => k.p.fase === f)
  return { fase: f, naam: faseInfo(f).naam, rol: ROLLEN[faseInfo(f).rol].kort, totaal: inFase.length, kaartjes: inFase.filter(k => vindt(k, zoek.value)) }
}))
const zin = computed(() => {
  const laat = kaartjes.value.filter(k => k.t.telaat).length
  return `${kaartjes.value.length} lopende projecten. ${laat ? `${laat} ${laat === 1 ? 'heeft' : 'hebben'} taken die te laat zijn.` : 'Niets te laat.'}`
})
</script>

<template>
  <main class="wrap">
    <p v-if="modus === 'proef'" class="melding">Proefversie. De projecten en datums komen uit het prototype; statussen, mensen en documenten zijn voorbeeldgegevens. Je wijzigingen blijven alleen in deze browser.</p>
    <header class="paginakop">
      <p class="label">Ontwikkeling, uitvoering en nazorg</p>
      <h1>Projecten</h1>
      <p v-if="stand === 'klaar'" class="zin">{{ zin }}</p>
    </header>

    <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /><span class="laden-regel" /></div>
    <div v-else-if="stand === 'fout'" class="leeg-staat">{{ fout }} <button type="button" class="link" @click="laad">Probeer het opnieuw</button></div>
    <template v-else>
      <div class="filters projectfilters">
        <input v-model="zoek" class="veld zoekveld" type="search" placeholder="Zoek op naam, nummer, plaats of persoon" aria-label="Zoek een project">
        <div class="filtergroep">
          <span class="label">Sorteer</span>
          <div class="seg" role="group" aria-label="Sorteer">
            <button v-for="s in SORTERINGEN" :key="s.id" type="button" :aria-pressed="sortering === s.id" @click="sortering = s.id">{{ s.naam }}</button>
          </div>
        </div>
      </div>
      <div class="kolommen">
        <section v-for="k in kolommen" :key="k.fase" class="kolom" :aria-labelledby="`kolom-${k.fase}`">
          <header class="kolom-kop">
            <h2 :id="`kolom-${k.fase}`">{{ k.naam }}</h2>
            <span class="klein n">{{ zoek.trim() ? `${k.kaartjes.length} van ${k.totaal}` : k.totaal }} · {{ k.rol }}</span>
          </header>
          <div class="kolom-lijst">
            <ProjectKaartje v-for="(kaartje, i) in k.kaartjes" :key="kaartje.p.id" :k="kaartje" :volgorde="i" :datum="datumBij(kaartje.p)" />
          </div>
          <p v-if="!k.kaartjes.length" class="leeg-staat klein">{{ zoek.trim() ? 'Niets gevonden.' : `Geen projecten in ${k.naam.toLowerCase()}.` }}</p>
        </section>
      </div>
    </template>
    <footer>Projectkaart BbDW · het volledige overzicht met planning, kaart en financieel komt in de volgende fase.</footer>
  </main>
</template>

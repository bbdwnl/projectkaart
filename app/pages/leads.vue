<script setup lang="ts">
import type { Licht, Project, Taak, Uitzondering } from '~/lib/types'
import { MENSEN, SOORTEN } from '~/lib/fasen'
import {
  AFLOPEND, amVan, GEEN_FILTER, kansGroep, KANSGROEPEN, leadsVan, leesQuery, maakSlug, naarQuery, past, SLAGINGSKANSEN, sorteer,
  type Lead, type LeadFilter, type LeadKolom,
} from '~/lib/leads'
import { fmt, geleden, vandaag } from '~/lib/datum'

// Alle leads in één lijst: wie ze heeft, hoe kansrijk ze zijn en wat er nog nodig is voor de overdracht.
// De filters staan in de adresbalk: terug vanaf een lead geeft dezelfde lijst, en een selectie is te delen.
useHead({ title: 'Leads · Projectkaart' })
const bron = useBron()
const { modus } = useGebruiker()
const { toon } = useToast()
const route = useRoute()
const router = useRouter()
const nu = vandaag()
const stand = ref<'laden' | 'klaar' | 'fout'>('laden')
const fout = ref('')
const projecten = ref<Project[]>([])
const taken = ref<Taak[]>([])
const catalogus = ref<Uitzondering[]>([])

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

// Filters <-> adresbalk. Klik je in het menu op Leads terwijl je hier al bent, dan gaan ze terug naar de standaard.
const begin = leesQuery(route.query)
const filter = reactive<LeadFilter>({ ...begin.filter })
const sortering = reactive({ ...begin.sortering })
const query = () => naarQuery(filter, sortering)
const zelfde = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b)
watch(query, (q) => {
  if (route.path === '/leads') router.replace({ query: q })
})
watch(() => route.query, (q) => {
  const uitUrl = leesQuery(q)
  if (route.path !== '/leads' || zelfde(naarQuery(uitUrl.filter, uitUrl.sortering), query())) return
  Object.assign(filter, uitUrl.filter)
  Object.assign(sortering, uitUrl.sortering)
})

const leads = computed(() => leadsVan(projecten.value, taken.value, catalogus.value, nu))
const zichtbaar = computed(() => sorteer(leads.value.filter(l => past(l, filter)), sortering))
/** De leads die door alle filters komen behalve deze: zo zegt het getal op een knop wat je krijgt. */
const zonder = (k: keyof LeadFilter) => leads.value.filter(l => past(l, { ...filter, [k]: GEEN_FILTER[k] }))
const gefilterd = computed(() => !zelfde({ ...filter, zoek: filter.zoek.trim() }, GEEN_FILTER))
const wis = () => Object.assign(filter, GEEN_FILTER)

const ams = computed(() => {
  const basis = zonder('am')
  const namen = new Set(leads.value.map(amVan))
  if (filter.am !== 'alle') namen.add(filter.am)
  return [...namen]
    .sort((a, b) => Number(a === 'geen') - Number(b === 'geen') || a.localeCompare(b, 'nl'))
    .map(id => ({ id, naam: id === 'geen' ? 'Zonder AM' : id, aantal: basis.filter(l => amVan(l) === id).length }))
})
const kansen = computed(() => {
  const basis = zonder('kans')
  return KANSGROEPEN
    .filter(k => filter.kans === k.id || leads.value.some(l => kansGroep(l.p.slagingskans) === k.id))
    .map(k => ({ ...k, aantal: basis.filter(l => kansGroep(l.p.slagingskans) === k.id).length }))
})
const aantalPrio = computed(() => zonder('prio').filter(l => l.p.prio).length)
const aantalKlaar = computed(() => zonder('klaar').filter(l => l.licht === 'klaar').length)

const zin = computed(() => {
  const n = leads.value.length
  if (!n) return 'Nog geen leads.'
  const hoog = leads.value.filter(l => kansGroep(l.p.slagingskans) === 'hoog').length
  const klaar = leads.value.filter(l => l.licht === 'klaar').length
  return `${n} ${n === 1 ? 'lead' : 'leads'}, waarvan ${hoog} met een kans van 75% of meer. ${klaar ? `${klaar} ${klaar === 1 ? 'is' : 'zijn'} klaar voor de overdracht.` : 'Nog geen enkele is klaar voor de overdracht.'}`
})

function sorteerOp(kolom: LeadKolom) {
  if (sortering.kolom === kolom) sortering.af = !sortering.af
  else Object.assign(sortering, { kolom, af: AFLOPEND[kolom] })
}
const pijl = (kolom: LeadKolom) => sortering.kolom !== kolom ? '' : sortering.af ? ' ↓' : ' ↑'

const WOORD: Record<Licht, string> = { telaat: 'Te laat', letop: 'Let op', open: 'Open', klaar: 'Klaar', later: 'Geen taken' }
const overdracht = (l: Lead) => l.licht === 'klaar' ? 'Klaar voor de overdracht' : l.open.length ? `Nog open: ${l.open.join(', ')}` : 'Geen taken voor de overdracht'
const soortTekst = (p: Project) => SOORTEN.filter(s => p.soort.includes(s.id)).map(s => s.naam).join(', ') || '—'
const m2Tekst = (p: Project) => p.m2 ? `${p.m2.toLocaleString('nl-NL')} m²` : '—'
const kansTekst = (p: Project) => p.slagingskans === null ? 'Kans onbekend' : `${p.slagingskans}%`
const mobiel = (l: Lead) => [kansTekst(l.p), l.p.am ?? 'Zonder AM', l.laatst && geleden(l.laatst, nu)].filter(Boolean).join(' · ')

// Nieuwe lead: de minste gegevens om hem in beeld te hebben. De rest vul je op de kaart in.
const nieuwOpen = ref(false)
const bezig = ref(false)
const nieuw = reactive({ naam: '', plaats: '', am: '', kans: '' })
async function maakLead() {
  const naam = nieuw.naam.trim()
  if (naam.length < 2) return toon('Geef de lead een naam van minstens twee letters.', 'fout')
  bezig.value = true
  try {
    const p = await bron.nieuweLead({
      slug: maakSlug(naam, projecten.value.map(x => x.slug)),
      naam,
      plaats: nieuw.plaats.trim() || null,
      am: nieuw.am || null,
      slagingskans: nieuw.kans === '' ? null : Number(nieuw.kans),
    })
    toon(`${p.naam} staat bij de leads`)
    await navigateTo(`/projecten/${p.slug}#details`)
  } catch (e) {
    toon(foutTekst(e), 'fout')
  } finally {
    bezig.value = false
  }
}
</script>

<template>
  <main class="wrap">
    <p v-if="modus === 'proef'" class="melding">Proefversie. De leads zijn verzonnen voorbeeldgegevens. Je wijzigingen blijven alleen in deze browser.</p>
    <header class="paginakop leadkop">
      <div>
        <p class="label">Kansen in beeld, nog voor de haalbaarheid</p>
        <h1>Leads</h1>
        <p v-if="stand === 'klaar'" class="zin">{{ zin }}</p>
      </div>
      <button type="button" class="knop zwart" :aria-expanded="nieuwOpen" aria-controls="nieuwe-lead" @click="nieuwOpen = !nieuwOpen">Nieuwe lead</button>
    </header>

    <Transition name="blok">
      <form v-if="nieuwOpen" id="nieuwe-lead" class="kaart nieuwe-lead" @submit.prevent="maakLead">
        <span class="tab nu">Nieuwe lead</span>
        <label><span class="label">Naam</span><input v-model="nieuw.naam" class="veld" required minlength="2" placeholder="Bijvoorbeeld Gezondheidscentrum De Brink"></label>
        <label><span class="label">Plaats</span><input v-model="nieuw.plaats" class="veld" placeholder="Plaats"></label>
        <label><span class="label">Accountmanager</span>
          <select v-model="nieuw.am" class="veld"><option value="">nog niet gekozen</option><option v-for="m in MENSEN.am" :key="m" :value="m">{{ m }}</option></select>
        </label>
        <label><span class="label">Slagingskans</span>
          <select v-model="nieuw.kans" class="veld"><option value="">onbekend</option><option v-for="k in SLAGINGSKANSEN" :key="k" :value="String(k)">{{ k }}%</option></select>
        </label>
        <div class="knoppen">
          <button type="submit" class="knop zwart" :disabled="bezig">{{ bezig ? 'Bezig…' : 'Opslaan' }}</button>
          <button type="button" class="link" @click="nieuwOpen = false">Annuleren</button>
        </div>
      </form>
    </Transition>

    <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /><span class="laden-regel" /></div>
    <div v-else-if="stand === 'fout'" class="leeg-staat">{{ fout }} <button type="button" class="link" @click="laad">Probeer het opnieuw</button></div>
    <div v-else-if="!leads.length" class="leeg-staat leadfilters">Nog geen leads. Voeg er een toe met Nieuwe lead, of zet een project op de kaart op de fase Lead.</div>
    <template v-else>
      <div class="filters leadfilters">
        <div class="filtergroep">
          <span class="label">Accountmanager</span>
          <div class="seg" role="group" aria-label="Accountmanager">
            <button type="button" :aria-pressed="filter.am === 'alle'" @click="filter.am = 'alle'">Alle <span class="n">{{ zonder('am').length }}</span></button>
            <button v-for="a in ams" :key="a.id" type="button" :aria-pressed="filter.am === a.id" @click="filter.am = a.id">{{ a.naam }} <span class="n">{{ a.aantal }}</span></button>
          </div>
        </div>
        <input v-model="filter.zoek" class="veld zoekveld" type="search" placeholder="Zoek op naam, plaats of nummer" aria-label="Zoek een lead">
      </div>
      <div class="filters">
        <div class="filtergroep">
          <span class="label">Kans</span>
          <div class="seg" role="group" aria-label="Slagingskans">
            <button type="button" :aria-pressed="filter.kans === 'alle'" @click="filter.kans = 'alle'">Alle <span class="n">{{ zonder('kans').length }}</span></button>
            <button v-for="k in kansen" :key="k.id" type="button" :aria-pressed="filter.kans === k.id" @click="filter.kans = k.id">{{ k.naam }} <span class="n">{{ k.aantal }}</span></button>
          </div>
        </div>
        <div class="filtergroep">
          <label class="schakel"><input v-model="filter.prio" type="checkbox"><span />Alleen prio <small class="n">{{ aantalPrio }}</small></label>
          <label class="schakel"><input v-model="filter.klaar" type="checkbox"><span />Klaar voor overdracht <small class="n">{{ aantalKlaar }}</small></label>
        </div>
      </div>
      <p class="telregel klein">
        <span class="n">{{ zichtbaar.length }} van {{ leads.length }} leads</span>
        <button v-if="gefilterd" type="button" class="link" @click="wis">Wis de filters</button>
      </p>

      <div v-if="zichtbaar.length" class="lijst leadlijst">
        <div class="kolkop">
          <span>Overdracht</span>
          <button type="button" class="sorteer" :aria-pressed="sortering.kolom === 'naam'" @click="sorteerOp('naam')">Lead{{ pijl('naam') }}</button>
          <button type="button" class="sorteer" :aria-pressed="sortering.kolom === 'kans'" @click="sorteerOp('kans')">Kans{{ pijl('kans') }}</button>
          <button type="button" class="sorteer" :aria-pressed="sortering.kolom === 'am'" @click="sorteerOp('am')">AM{{ pijl('am') }}</button>
          <span>Soort</span>
          <button type="button" class="sorteer" :aria-pressed="sortering.kolom === 'm2'" @click="sorteerOp('m2')">m²{{ pijl('m2') }}</button>
          <button type="button" class="sorteer" :aria-pressed="sortering.kolom === 'laatst'" @click="sorteerOp('laatst')">Laatst gewijzigd{{ pijl('laatst') }}</button>
        </div>
        <div class="lijst-in">
          <NuxtLink v-for="(l, i) in zichtbaar" :key="l.p.id" :to="`/projecten/${l.p.slug}`" class="rij leadrij" :style="{ '--i': Math.min(i, 12) }">
            <div class="rij-hoofd">
              <span><StatusTab :licht="l.licht" :woord="WOORD[l.licht]" /></span>
              <span class="titel">
                {{ l.p.naam }}<span v-if="l.p.prio" class="tab telaat prio">Prio</span>
                <small>{{ [l.p.nummer, l.p.plaats].filter(Boolean).join(' · ') || 'Nog geen plaats' }} · {{ overdracht(l) }}</small>
                <small class="mobiel">{{ mobiel(l) }}</small>
              </span>
              <span class="n kans">{{ l.p.slagingskans === null ? '—' : `${l.p.slagingskans}%` }}<span v-if="l.p.slagingskans !== null" class="voortgang"><i :style="{ width: `${l.p.slagingskans}%` }" /></span></span>
              <span>{{ l.p.am ?? '—' }}</span>
              <span class="klein">{{ soortTekst(l.p) }}</span>
              <span class="n">{{ m2Tekst(l.p) }}</span>
              <span class="deadline">{{ l.laatst ? geleden(l.laatst, nu) : '—' }}<small v-if="l.laatst">{{ fmt(new Date(l.laatst)) }}</small></span>
            </div>
          </NuxtLink>
        </div>
      </div>
      <p v-else class="leeg-staat">Geen lead past bij deze filters. <button type="button" class="link" @click="wis">Wis de filters</button></p>
    </template>
    <footer>Projectkaart BbDW · een lead gaat naar Projecten zodra je op de kaart de fase op Haalbaarheid zet.</footer>
  </main>
</template>

<script setup lang="ts">
import type { Licht, Project } from '~/lib/types'
import { SOORTEN } from '~/lib/fasen'
import {
  AFLOPEND, amVan, GEEN_FILTER, kansGroep, KANSGROEPEN, leesQuery, naarQuery, past, sorteer,
  type Lead, type LeadFilter, type LeadKolom, type LijstFase,
} from '~/lib/leads'
import { fmt, geleden, naarDatum, vandaag } from '~/lib/datum'

// De lijst van Leads en van Haalbaarheid: wie het project heeft, hoe kansrijk het is en wat er nog nodig is voor de
// overdracht. Haalbaarheid toont ook de prognose van start casco. De filters staan in de adresbalk: terug vanaf een
// project geeft dezelfde lijst, en een selectie is te delen.
const props = defineProps<{ fase: LijstFase, regels: Lead[] }>()
const route = useRoute()
const router = useRouter()
const nu = vandaag()
const pad = route.path
const isLead = computed(() => props.fase === 'lead')
const woord = computed(() => isLead.value ? { een: 'lead', meer: 'leads', kop: 'Lead' } : { een: 'project', meer: 'projecten', kop: 'Project' })

// Filters <-> adresbalk. Klik je in het menu op de pagina terwijl je er al bent, dan gaan ze terug naar de standaard.
// Andere sleutels in de adresbalk (zoals het tabblad) blijven staan.
const EIGEN = ['zoek', 'am', 'kans', 'prio', 'klaar', 'sort', 'richting']
const begin = leesQuery(route.query)
const filter = reactive<LeadFilter>({ ...begin.filter })
const sortering = reactive({ ...begin.sortering })
const query = () => naarQuery(filter, sortering)
const zelfde = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b)
watch(query, (q) => {
  if (route.path !== pad) return
  const rest = Object.fromEntries(Object.entries(route.query).filter(([k]) => !EIGEN.includes(k)))
  router.replace({ query: { ...rest, ...q } })
})
watch(() => route.query, (q) => {
  const uitUrl = leesQuery(q)
  if (route.path !== pad || zelfde(naarQuery(uitUrl.filter, uitUrl.sortering), query())) return
  Object.assign(filter, uitUrl.filter)
  Object.assign(sortering, uitUrl.sortering)
})

const zichtbaar = computed(() => sorteer(props.regels.filter(l => past(l, filter)), sortering))
/** De regels die door alle filters komen behalve deze: zo zegt het getal op een knop wat je krijgt. */
const zonder = (k: keyof LeadFilter) => props.regels.filter(l => past(l, { ...filter, [k]: GEEN_FILTER[k] }))
const gefilterd = computed(() => !zelfde({ ...filter, zoek: filter.zoek.trim() }, GEEN_FILTER))
const wis = () => Object.assign(filter, GEEN_FILTER)

const ams = computed(() => {
  const basis = zonder('am')
  const namen = new Set(props.regels.map(amVan))
  if (filter.am !== 'alle') namen.add(filter.am)
  return [...namen]
    .sort((a, b) => Number(a === 'geen') - Number(b === 'geen') || a.localeCompare(b, 'nl'))
    .map(id => ({ id, naam: id === 'geen' ? 'Zonder AM' : id, aantal: basis.filter(l => amVan(l) === id).length }))
})
const kansen = computed(() => {
  const basis = zonder('kans')
  return KANSGROEPEN
    .filter(k => filter.kans === k.id || props.regels.some(l => kansGroep(l.p.slagingskans) === k.id))
    .map(k => ({ ...k, aantal: basis.filter(l => kansGroep(l.p.slagingskans) === k.id).length }))
})
const aantalPrio = computed(() => zonder('prio').filter(l => l.p.prio).length)
const aantalKlaar = computed(() => zonder('klaar').filter(l => l.licht === 'klaar').length)

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
const prognose = (p: Project) => p.prognose_casco ? fmt(naarDatum(p.prognose_casco)) : null
const mobiel = (l: Lead) => [
  l.p.nummer, kansTekst(l.p), l.p.am ?? 'Zonder AM', !isLead.value && prognose(l.p) && `casco ${prognose(l.p)}`, l.laatst && geleden(l.laatst, nu),
].filter(Boolean).join(' · ')
</script>

<template>
  <div>
    <div class="filters leadfilters">
      <div class="filtergroep">
        <span class="label">Accountmanager</span>
        <div class="seg" role="group" aria-label="Accountmanager">
          <button type="button" :aria-pressed="filter.am === 'alle'" @click="filter.am = 'alle'">Alle <span class="n">{{ zonder('am').length }}</span></button>
          <button v-for="a in ams" :key="a.id" type="button" :aria-pressed="filter.am === a.id" @click="filter.am = a.id">{{ a.naam }} <span class="n">{{ a.aantal }}</span></button>
        </div>
      </div>
      <input v-model="filter.zoek" class="veld zoekveld" type="search" placeholder="Zoek op naam, plaats of projectnummer" :aria-label="`Zoek een ${woord.een}`">
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
      <span class="n">{{ zichtbaar.length }} van {{ regels.length }} {{ woord.meer }}</span>
      <button v-if="gefilterd" type="button" class="link" @click="wis">Wis de filters</button>
    </p>

    <div v-if="zichtbaar.length" class="lijst leadlijst" :class="{ 'met-prognose': !isLead }">
      <div class="kolkop">
        <span>Overdracht</span>
        <button type="button" class="sorteer" :aria-pressed="sortering.kolom === 'naam'" @click="sorteerOp('naam')">{{ woord.kop }}{{ pijl('naam') }}</button>
        <span>Nummer</span>
        <button type="button" class="sorteer" :aria-pressed="sortering.kolom === 'kans'" @click="sorteerOp('kans')">Kans{{ pijl('kans') }}</button>
        <button type="button" class="sorteer" :aria-pressed="sortering.kolom === 'am'" @click="sorteerOp('am')">AM{{ pijl('am') }}</button>
        <span>Soort</span>
        <button type="button" class="sorteer" :aria-pressed="sortering.kolom === 'm2'" @click="sorteerOp('m2')">m²{{ pijl('m2') }}</button>
        <button v-if="!isLead" type="button" class="sorteer" :aria-pressed="sortering.kolom === 'prognose'" title="Prognose start casco" @click="sorteerOp('prognose')">Prognose casco{{ pijl('prognose') }}</button>
        <button type="button" class="sorteer" :aria-pressed="sortering.kolom === 'laatst'" @click="sorteerOp('laatst')">Laatst gewijzigd{{ pijl('laatst') }}</button>
      </div>
      <div class="lijst-in">
        <NuxtLink v-for="(l, i) in zichtbaar" :key="l.p.id" :to="`/projecten/${l.p.slug}`" class="rij leadrij" :style="{ '--i': Math.min(i, 12) }">
          <div class="rij-hoofd">
            <span><StatusTab :licht="l.licht" :woord="WOORD[l.licht]" /></span>
            <span class="titel">
              {{ l.p.naam }}<span v-if="l.p.prio" class="tab telaat prio">Prio</span>
              <small>{{ l.p.plaats || 'Nog geen plaats' }} · {{ overdracht(l) }}</small>
              <small class="mobiel">{{ mobiel(l) }}</small>
            </span>
            <span class="n">{{ l.p.nummer ?? '—' }}</span>
            <span class="n kans">{{ l.p.slagingskans === null ? '—' : `${l.p.slagingskans}%` }}<span v-if="l.p.slagingskans !== null" class="voortgang"><i :style="{ width: `${l.p.slagingskans}%` }" /></span></span>
            <span>{{ l.p.am ?? '—' }}</span>
            <span class="klein">{{ soortTekst(l.p) }}</span>
            <span class="n">{{ m2Tekst(l.p) }}</span>
            <span v-if="!isLead" class="n">{{ prognose(l.p) ?? '—' }}</span>
            <span class="deadline">{{ l.laatst ? geleden(l.laatst, nu) : '—' }}<small v-if="l.laatst">{{ fmt(new Date(l.laatst)) }}</small></span>
          </div>
        </NuxtLink>
      </div>
    </div>
    <p v-else class="leeg-staat">Geen {{ woord.een }} past bij deze filters. <button type="button" class="link" @click="wis">Wis de filters</button></p>
  </div>
</template>

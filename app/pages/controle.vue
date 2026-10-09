<script setup lang="ts">
import type { Controlepunt, Leverancier, Project } from '~/lib/types'
import { groepeerPunten, pastPunt, pdfNaam, telPunten, type ControleFilter, type Indeling } from '~/lib/controle'
import { fmt, fmtMoment, vandaag } from '~/lib/datum'

// Alle aandachtspunten over alle projecten. Per project (eventueel één leverancier) of per leverancier
// over alle projecten, en daarvan een pdf om te versturen. De keuze staat in de adresbalk.
useHead({ title: 'Controle · Projectkaart' })
const bron = useBron()
const { modus } = useGebruiker()
const { toon } = useToast()
const route = useRoute()
const router = useRouter()
const nu = vandaag()
const stand = ref<'laden' | 'klaar' | 'fout'>('laden')
const fout = ref('')
const projecten = ref<Project[]>([])
const leveranciers = ref<Leverancier[]>([])
const punten = ref<Controlepunt[]>([])
const fotos = ref<Record<string, string>>({})

async function laad() {
  stand.value = 'laden'
  try {
    ;[projecten.value, leveranciers.value, punten.value] = await Promise.all([bron.projecten(), bron.leveranciers(), bron.controlepunten()])
    stand.value = 'klaar'
  } catch (e) {
    fout.value = foutTekst(e)
    stand.value = 'fout'
  }
}
onMounted(laad)

// ---------- keuze, ook in de adresbalk ----------
const STATUSSEN: { id: ControleFilter, naam: string, selectie: string }[] = [
  { id: 'open', naam: 'Open', selectie: 'Open aandachtspunten' },
  { id: 'opgelost', naam: 'Opgelost', selectie: 'Opgeloste aandachtspunten' },
  { id: 'alles', naam: 'Alles', selectie: 'Alle aandachtspunten' },
]
const tekst = (v: unknown) => (typeof v === 'string' ? v : '')
const uitUrl = () => ({
  indeling: (tekst(route.query.op) === 'leverancier' ? 'leverancier' : 'project') as Indeling,
  gekozen: tekst(route.query.id) || null,
  leverancier: tekst(route.query.lev) || 'alle',
  status: (STATUSSEN.find(s => s.id === tekst(route.query.status))?.id ?? 'open') as ControleFilter,
})
const keuze = reactive(uitUrl())
const naarUrl = () => {
  const q: Record<string, string> = {}
  if (keuze.indeling === 'leverancier') q.op = 'leverancier'
  if (keuze.gekozen) q.id = keuze.gekozen
  if (keuze.indeling === 'project' && keuze.leverancier !== 'alle') q.lev = keuze.leverancier
  if (keuze.status !== 'open') q.status = keuze.status
  return q
}
watch(naarUrl, (q) => {
  if (route.path === '/controle') router.replace({ query: q })
})
watch(() => route.query, () => {
  if (route.path !== '/controle' || JSON.stringify(naarUrl()) === JSON.stringify(route.query)) return
  Object.assign(keuze, uitUrl())
})
function kiesIndeling(op: Indeling) {
  if (op === keuze.indeling) return
  Object.assign(keuze, { indeling: op, gekozen: null, leverancier: 'alle' })
}
function kies(id: string) {
  Object.assign(keuze, { gekozen: id, leverancier: 'alle' })
}

// ---------- namen en tellingen ----------
const projectNaam = (id: string) => projecten.value.find(p => p.id === id)?.naam ?? 'Onbekend project'
const leverancierNaam = (id: string | null) => !id || id === 'geen' ? 'Zonder leverancier' : leveranciers.value.find(l => l.id === id)?.naam ?? 'Onbekende leverancier'
const naam = (op: Indeling, id: string) => (op === 'project' ? projectNaam(id) : leverancierNaam(id))

const STATUS_TEKST = computed(() => STATUSSEN.find(s => s.id === keuze.status)!)
/** De lijst links: projecten of leveranciers met aandachtspunten, het meest open bovenaan. */
const keuzelijst = computed(() => [...telPunten(punten.value, keuze.indeling)]
  .map(([id, t]) => ({ id, naam: naam(keuze.indeling, id), ...t }))
  .sort((a, b) => Number(a.id === 'geen') - Number(b.id === 'geen') || b.open - a.open || a.naam.localeCompare(b.naam, 'nl')))
// Niets (of iets dat niet meer bestaat) gekozen: dan het eerste uit de lijst.
watch(keuzelijst, (lijst) => {
  if (lijst.length && !lijst.some(k => k.id === keuze.gekozen)) keuze.gekozen = lijst[0]!.id
})

const vanGekozen = computed(() => punten.value.filter(p => keuze.gekozen && (keuze.indeling === 'project' ? p.project_id === keuze.gekozen : (p.leverancier_id ?? 'geen') === keuze.gekozen)))
/** Bij een project: de leveranciers met punten op dat project, om er één te kiezen. */
const leverancierKeuzes = computed(() => keuze.indeling !== 'project' ? [] : [...telPunten(vanGekozen.value, 'leverancier')]
  .map(([id, t]) => ({ id, naam: leverancierNaam(id), ...t }))
  .sort((a, b) => Number(a.id === 'geen') - Number(b.id === 'geen') || a.naam.localeCompare(b.naam, 'nl')))
const zichtbaar = computed(() => vanGekozen.value.filter(p => pastPunt(p, keuze.status, keuze.indeling === 'project' ? keuze.leverancier : 'alle')))
/** Bij een project per leverancier, bij een leverancier per project. */
const anders = computed<Indeling>(() => (keuze.indeling === 'project' ? 'leverancier' : 'project'))
const groepen = computed(() => groepeerPunten(zichtbaar.value, anders.value, id => naam(anders.value, id)))

const titel = computed(() => (keuze.gekozen ? naam(keuze.indeling, keuze.gekozen) : ''))
const ondertitel = computed(() => keuze.indeling === 'leverancier'
  ? 'Alle projecten'
  : keuze.leverancier === 'alle' ? 'Alle leveranciers' : leverancierNaam(keuze.leverancier))
const gekozenProject = computed(() => (keuze.indeling === 'project' ? projecten.value.find(p => p.id === keuze.gekozen) : undefined))
const vak = computed(() => (keuze.indeling === 'leverancier' ? leveranciers.value.find(l => l.id === keuze.gekozen)?.vak : null))

const totaalOpen = computed(() => punten.value.filter(p => !p.opgelost).length)
const zin = computed(() => {
  if (!punten.value.length) return 'Nog geen aandachtspunten.'
  const ps = new Set(punten.value.filter(p => !p.opgelost).map(p => p.project_id)).size
  return totaalOpen.value
    ? `${totaalOpen.value} ${totaalOpen.value === 1 ? 'aandachtspunt staat' : 'aandachtspunten staan'} open, op ${ps} ${ps === 1 ? 'project' : 'projecten'}.`
    : 'Alle aandachtspunten zijn opgelost.'
})

// Foto's van wat in beeld is (bij Supabase een uur geldig).
watch(zichtbaar, async (ps) => {
  const nieuw = [...new Set(ps.map(p => p.foto))].filter(f => !fotos.value[f])
  if (!nieuw.length) return
  try {
    fotos.value = { ...fotos.value, ...await bron.fotoUrls(nieuw) }
  } catch { /* zonder foto */ }
})

// ---------- pdf ----------
const bezig = ref(false)
async function pdf() {
  if (!zichtbaar.value.length) return
  bezig.value = true
  try {
    const paden = [...new Set(zichtbaar.value.map(p => p.foto))]
    const urls = await bron.fotoUrls(paden).catch(() => ({} as Record<string, string>))
    await maakControlePdf({
      titel: titel.value,
      ondertitel: ondertitel.value,
      selectie: STATUS_TEKST.value.selectie,
      bijLabel: anders.value === 'project' ? 'Project' : 'Leverancier',
      groepen: groepen.value.map(g => ({
        titel: g.titel,
        punten: g.punten.map(p => ({ punt: p, fotoUrl: urls[p.foto] ?? null, bij: g.titel })),
      })),
      bestandsnaam: pdfNaam([titel.value, ondertitel.value], fmt(nu)),
    })
    toon('Pdf gemaakt')
  } catch (e) {
    toon(`De pdf maken is niet gelukt. ${foutTekst(e)}`, 'fout')
  } finally {
    bezig.value = false
  }
}
</script>

<template>
  <main class="wrap">
    <p v-if="modus === 'proef'" class="melding">Proefversie. De aandachtspunten zijn voorbeeldgegevens, allemaal met dezelfde foto. Je wijzigingen blijven alleen in deze browser.</p>
    <header class="paginakop">
      <p class="label">Over alle projecten</p>
      <h1>Controle</h1>
      <p v-if="stand === 'klaar'" class="zin">{{ zin }}</p>
    </header>

    <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /><span class="laden-regel" /></div>
    <div v-else-if="stand === 'fout'" class="leeg-staat">{{ fout }} <button type="button" class="link" @click="laad">Probeer het opnieuw</button></div>
    <div v-else-if="!punten.length" class="leeg-staat controle-leeg">Nog geen aandachtspunten. Ze komen erbij via het tabblad Controle op een projectkaart.</div>
    <template v-else>
      <div class="filters controle-filters">
        <div class="seg" role="group" aria-label="Overzicht">
          <button type="button" :aria-pressed="keuze.indeling === 'project'" @click="kiesIndeling('project')">Per project</button>
          <button type="button" :aria-pressed="keuze.indeling === 'leverancier'" @click="kiesIndeling('leverancier')">Per leverancier</button>
        </div>
        <div class="seg" role="group" aria-label="Welke aandachtspunten">
          <button v-for="s in STATUSSEN" :key="s.id" type="button" :aria-pressed="keuze.status === s.id" @click="keuze.status = s.id">{{ s.naam }}</button>
        </div>
      </div>

      <div class="controle-overzicht">
        <nav class="lijst keuzelijst" :aria-label="keuze.indeling === 'project' ? 'Projecten met aandachtspunten' : 'Leveranciers met aandachtspunten'">
          <button v-for="k in keuzelijst" :key="k.id" type="button" class="keuze" :aria-current="keuze.gekozen === k.id ? 'true' : undefined" @click="kies(k.id)">
            <b>{{ k.naam }}</b>
            <small>{{ k.open }} open · {{ k.totaal }} totaal</small>
          </button>
        </nav>

        <section v-if="keuze.gekozen" class="overzicht" aria-live="polite">
          <div class="overzicht-kop">
            <div>
              <p class="label">{{ keuze.indeling === 'project' ? 'Project' : vak || 'Leverancier' }}</p>
              <h2>{{ titel }}</h2>
              <p class="klein">
                {{ ondertitel }} · {{ STATUS_TEKST.selectie.toLowerCase() }}: {{ zichtbaar.length }}
                <template v-if="gekozenProject"> · <NuxtLink :to="`/projecten/${gekozenProject.slug}#controle`">naar de kaart</NuxtLink></template>
              </p>
            </div>
            <div class="overzicht-acties">
              <select v-if="keuze.indeling === 'project'" v-model="keuze.leverancier" class="veld pil" aria-label="Leverancier">
                <option value="alle">Alle leveranciers</option>
                <option v-for="l in leverancierKeuzes" :key="l.id" :value="l.id">{{ l.naam }} ({{ l.open }} open)</option>
              </select>
              <button type="button" class="knop zwart" :disabled="bezig || !zichtbaar.length" @click="pdf">{{ bezig ? 'Pdf maken…' : 'Pdf maken' }}</button>
            </div>
          </div>

          <div v-for="g in groepen" :key="g.sleutel" class="puntgroep">
            <h3>
              <NuxtLink v-if="anders === 'project'" :to="`/projecten/${projecten.find(p => p.id === g.sleutel)?.slug}#controle`">{{ g.titel }}</NuxtLink>
              <template v-else>{{ g.titel }}</template>
              <span class="klein">{{ g.punten.length }} {{ g.punten.length === 1 ? 'punt' : 'punten' }}</span>
            </h3>
            <ol class="lijst puntlijst">
              <li v-for="p in g.punten" :key="p.id" class="rij">
                <div class="rij-hoofd">
                  <span class="duim"><img v-if="fotos[p.foto]" :src="fotos[p.foto]" alt="" loading="lazy"></span>
                  <div class="titel">
                    <span class="notitie">{{ p.notitie }}</span>
                    <small>Gemeld door {{ p.aangemaakt_door ?? 'onbekend' }} · {{ fmtMoment(p.aangemaakt_op, nu) }}</small>
                    <small v-if="p.opgelost && p.opgelost_op">Opgelost door {{ p.opgelost_door ?? 'onbekend' }} · {{ fmtMoment(p.opgelost_op, nu) }}</small>
                  </div>
                  <span><StatusTab :licht="p.opgelost ? 'klaar' : 'letop'" :woord="p.opgelost ? 'Opgelost' : 'Open'" /></span>
                </div>
              </li>
            </ol>
          </div>
          <div v-if="!zichtbaar.length" class="leeg-staat">Niets {{ keuze.status === 'opgelost' ? 'opgelost' : keuze.status === 'open' ? 'open' : '' }} in deze selectie.</div>
        </section>
      </div>
    </template>
    <footer>Projectkaart BbDW</footer>
  </main>
</template>

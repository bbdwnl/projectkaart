<script setup lang="ts">
import type { Tekening } from '~/lib/types'
import { CODE_VORM, type ExternAntwoord, type ExternInhoud, type ExternPunt, type ExternTekening } from '~/lib/deellink'
import { pinsVan } from '~/lib/tekening'
import { pdfNaam } from '~/lib/controle'
import { fmt } from '~/lib/datum'

// De pagina van een leverancier, zonder account. Eerst de code van vijf cijfers (dit apparaat onthoudt hem),
// dan alleen zijn open aandachtspunten: per project of alles, met de foto en de plek op de hele tekening.
// Van wat hij ziet, maakt hij zelf een pdf (dezelfde als bij BbDW, zonder wie het punt meldde).
// Is de link verlopen, ingetrokken of alles opgelost, dan zegt de pagina dat, en verder niets.
definePageMeta({ extern: true })
useHead({ title: 'Open punten · BbDW', meta: [{ name: 'referrer', content: 'no-referrer' }] })
const bron = useBron()
const { modus } = useGebruiker()
const { toon } = useToast()
const route = useRoute()
const token = String(route.params.token ?? '')
const SLEUTEL = `bbdw_punten_${token.slice(0, 16)}`

const stand = ref<'laden' | 'fout' | ExternAntwoord['stand']>('laden')
const antwoord = shallowRef<ExternAntwoord | null>(null)
const inhoud = shallowRef<ExternInhoud | null>(null)
const fout = ref('')
const code = ref('')
const codeMelding = ref('')
const codeVak = ref<HTMLInputElement>()
const bezig = ref(false)
let geladenOp = 0

const onthouden = () => {
  try { return localStorage.getItem(SLEUTEL) ?? '' } catch { return '' }
}
function onthoud(c: string) {
  try {
    if (c) localStorage.setItem(SLEUTEL, c)
    else localStorage.removeItem(SLEUTEL)
  } catch { /* privévenster: dan elke keer de code */ }
}

async function laad(c = code.value) {
  if (bezig.value) return
  bezig.value = true
  try {
    const a = await bron.externeInhoud(token, c)
    antwoord.value = a
    inhoud.value = a.stand === 'open' ? a.inhoud : null
    stand.value = a.stand
    if (a.stand === 'open') {
      geladenOp = Date.now()
      onthoud(c)
      return
    }
    onthoud('')
    if (a.stand === 'code') {
      codeMelding.value = a.fout ? `Deze code klopt niet. Nog ${a.over} ${a.over === 1 ? 'poging' : 'pogingen'}.` : ''
      code.value = ''
      nextTick(() => codeVak.value?.focus())
    }
  } catch (e) {
    fout.value = foutTekst(e)
    stand.value = 'fout'
  } finally {
    bezig.value = false
  }
}

// ---------- de code ----------
function typ(e: Event) {
  const vak = e.target as HTMLInputElement
  const cijfers = vak.value.replace(/\D/g, '').slice(0, 5)
  vak.value = code.value = cijfers
  codeMelding.value = /[01]/.test(cijfers) ? 'De code heeft alleen de cijfers 2 tot en met 9.' : ''
  if (CODE_VORM.test(cijfers)) laad(cijfers)
}
function verstuur() {
  if (CODE_VORM.test(code.value)) laad()
  else codeMelding.value = 'Vul de vijf cijfers van de code in.'
}
function vergeet() {
  onthoud('')
  code.value = ''
  codeMelding.value = ''
  inhoud.value = null
  stand.value = 'code'
  nextTick(() => codeVak.value?.focus())
}

// ---------- wat er open staat ----------
const keuze = ref('alle')
const projecten = computed(() => (inhoud.value?.projecten ?? []).map(p => ({
  ...p,
  punten: inhoud.value!.punten.filter(x => x.project_id === p.id),
  tekeningen: inhoud.value!.tekeningen.filter(t => t.project_id === p.id),
})))
watch(projecten, (ps) => {
  if (keuze.value !== 'alle' && !ps.some(p => p.id === keuze.value)) keuze.value = 'alle'
})
const zichtbaar = computed(() => (keuze.value === 'alle' ? projecten.value : projecten.value.filter(p => p.id === keuze.value)))
const aantal = computed(() => inhoud.value?.punten.length ?? 0)
const zin = computed(() => {
  const ps = projecten.value.length
  return `${aantal.value} ${aantal.value === 1 ? 'punt staat' : 'punten staan'} open${ps > 1 ? `, op ${ps} projecten` : ''}.`
})
const geldigTot = computed(() => (inhoud.value ? fmt(new Date(inhoud.value.geldig_tot)) : ''))
/** Het adres, of de plaats als die niet al in de projectnaam staat. */
const waar = (p: { naam: string, adres: string | null, plaats: string | null }) =>
  p.adres || (p.plaats && !p.naam.toLowerCase().includes(p.plaats.toLowerCase()) ? p.plaats : '')

// Dicht, onbekend of een fout: wat de pagina dan zegt.
const dicht = computed(() => {
  const a = antwoord.value
  const op = a && 'op' in a ? fmt(new Date(a.op)) : ''
  switch (stand.value) {
    case 'opgelost': return { tab: 'Opgelost', licht: 'klaar', titel: 'Alles is opgelost.', tekst: `Dank je wel. Alle punten op deze pagina zijn opgelost, dus de link is gesloten${op ? ` (${op})` : ''}.` }
    case 'verlopen': return { tab: 'Verlopen', licht: 'letop', titel: 'Deze link is verlopen.', tekst: `De link was geldig tot ${op}. Staan er nog punten open? Vraag BbDW om een nieuwe link.` }
    case 'ingetrokken': return { tab: 'Gesloten', licht: 'later', titel: 'Deze link is gesloten.', tekst: 'BbDW heeft deze link ingetrokken. Heb je hem nog nodig? Vraag je contactpersoon bij BbDW om een nieuwe.' }
    case 'geblokkeerd': return { tab: 'Gesloten', licht: 'telaat', titel: 'Deze link is gesloten.', tekst: 'Er is te vaak een verkeerde code ingevuld. Vraag BbDW om een nieuwe link.' }
    case 'onbekend': return { tab: 'Onbekend', licht: 'later', titel: 'Deze link bestaat niet.', tekst: 'Kijk of je de hele link hebt overgenomen, of vraag BbDW om een nieuwe.' }
    default: return { tab: 'Fout', licht: 'telaat', titel: 'De pagina kon niet laden.', tekst: fout.value }
  }
})

// ---------- foto en tekening ----------
const groot = ref<ExternPunt | null>(null)
const venster = ref<HTMLDialogElement>()
function toonFoto(p: ExternPunt) {
  groot.value = p
  nextTick(() => venster.value?.showModal())
}
// Het adres van een foto is tijdelijk: is het verlopen, dan alles opnieuw ophalen.
function fotoFout() {
  if (Date.now() - geladenOp > 60_000) laad()
}

type ProjectMetPunten = (typeof projecten.value)[number]
const viewer = ref<{ projectId: string, tekeningId: string, punt: ExternPunt | null, titel: string } | null>(null)
const alsTekening = (t: ExternTekening): Tekening => ({ ...t, pad: '', aangemaakt_door: null, aangemaakt_op: '' })
const viewerTekeningen = computed(() => (inhoud.value?.tekeningen ?? []).filter(t => t.project_id === viewer.value?.projectId).map(alsTekening))
const viewerPins = computed(() => pinsVan((inhoud.value?.punten ?? []).filter(p => p.project_id === viewer.value?.projectId).map(p => ({ ...p, opgelost: false })), p => p.nummer))
const tekeningUrl = (t: Tekening) => bron.externeTekeningUrl(token, code.value, t.id)
const tekeningTekst = (p: ExternPunt) => {
  const t = inhoud.value?.tekeningen.find(x => x.id === p.tekening_id)
  return t ? `${t.naam}, blad ${p.tekening_blad}` : ''
}
/** De hele tekening met al zijn punten; bij meer tekeningen die met de meeste punten eerst. */
function heleTekening(p: ProjectMetPunten) {
  const op = (t: ExternTekening) => p.punten.filter(x => x.tekening_id === t.id).length
  const t = [...p.tekeningen].sort((a, b) => op(b) - op(a))[0]
  if (t) viewer.value = { projectId: p.id, tekeningId: t.id, punt: null, titel: p.naam }
}
function opTekening(punt: ExternPunt) {
  if (punt.tekening_id) viewer.value = { projectId: punt.project_id, tekeningId: punt.tekening_id, punt, titel: `#${punt.nummer} · ${punt.notitie}` }
}
const plekVan = (p: ExternPunt | null) => (p?.tekening_id ? { tekening_id: p.tekening_id, blad: p.tekening_blad!, x: p.tekening_x!, y: p.tekening_y! } : null)

// ---------- pdf van wat hij ziet ----------
const pdfBezig = ref(false)
async function pdf() {
  if (!inhoud.value || pdfBezig.value) return
  pdfBezig.value = true
  const blobs: string[] = []
  try {
    const i = inhoud.value
    const ps = zichtbaar.value
    // Per tekening één adres, voor de uitsnede met de plek.
    const tekeningUrls = new Map<string, string | null>()
    for (const id of new Set(ps.flatMap(p => p.punten.map(x => x.tekening_id)).filter((t): t is string => !!t))) {
      const url = await bron.externeTekeningUrl(token, code.value, id).catch(() => null)
      if (url?.startsWith('blob:')) blobs.push(url)
      tekeningUrls.set(id, url)
    }
    const ondertitel = keuze.value === 'alle' ? 'Alle projecten' : ps[0]?.naam ?? ''
    const blob = await maakControlePdf({
      titel: i.leverancier.naam,
      ondertitel,
      selectie: 'Open aandachtspunten',
      bijLabel: '',
      groepen: ps.map(p => ({
        titel: [p.naam, waar(p)].filter(Boolean).join(' · '),
        punten: p.punten.map((x) => {
          const url = x.tekening_id ? tekeningUrls.get(x.tekening_id) : null
          return {
            punt: { id: x.id, notitie: x.notitie, aangemaakt_op: x.aangemaakt_op, opgelost: false, opgelost_door: null, opgelost_op: null },
            nummer: x.nummer, fotoUrl: x.foto, bij: '',
            plek: url ? { url, blad: x.tekening_blad!, x: x.tekening_x!, y: x.tekening_y!, tekst: tekeningTekst(x) } : null,
          }
        }),
      })),
    })
    downloaden(blob, pdfNaam([i.leverancier.naam, ondertitel], fmt(new Date())))
  } catch (e) {
    toon(`De pdf maken is niet gelukt. ${foutTekst(e)}`, 'fout')
  } finally {
    for (const b of blobs) URL.revokeObjectURL(b)
    pdfBezig.value = false
  }
}

// Wie de pagina lang open laat staan: bij terugkomen na drie kwartier opnieuw ophalen (foto's, en of hij nog open is).
function terugGekomen() {
  if (document.visibilityState === 'visible' && stand.value === 'open' && Date.now() - geladenOp > 45 * 60_000) laad()
}
onMounted(() => {
  code.value = onthouden()
  laad()
  document.addEventListener('visibilitychange', terugGekomen)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', terugGekomen))
</script>

<template>
  <main class="extern">
    <div v-if="stand === 'laden'" class="poort" aria-busy="true">
      <div class="kaart poort-kaart">
        <BbdwLogo class="login-logo" />
        <span class="laden-regel titel" /><span class="laden-regel kort" />
      </div>
    </div>

    <div v-else-if="stand === 'code'" class="poort">
      <form class="kaart poort-kaart" novalidate @submit.prevent="verstuur">
        <span v-if="modus === 'proef'" class="tab later">Proefversie</span>
        <BbdwLogo class="login-logo" />
        <p class="label">Open punten</p>
        <h1>Vul je code in.</h1>
        <p class="lead">Je kreeg van BbDW een link naar deze pagina, en apart een code van vijf cijfers.</p>
        <label class="code-veld">
          <span class="label">Code</span>
          <input
            ref="codeVak" :value="code" class="veld code-invoer n" type="text" inputmode="numeric" autocomplete="one-time-code"
            maxlength="5" placeholder="•••••" aria-describedby="code-melding" :disabled="bezig" autofocus @input="typ"
          >
        </label>
        <button type="submit" class="knop zwart groot" :disabled="bezig">{{ bezig ? 'Openen…' : 'Openen' }}</button>
        <p v-if="codeMelding" id="code-melding" class="fout-melding" role="alert">{{ codeMelding }}</p>
        <p v-if="modus === 'proef'" class="proef-uitleg">Proefversie van de projectkaart van BbDW. Wie de link maakte, vindt de code onder Controle → Delen met extern.</p>
      </form>
    </div>

    <div v-else-if="stand !== 'open' || !inhoud" class="poort">
      <div class="kaart poort-kaart">
        <span class="tab" :class="dicht.licht">{{ dicht.tab }}</span>
        <BbdwLogo class="login-logo" />
        <p class="label">Open punten</p>
        <h1>{{ dicht.titel }}</h1>
        <p class="lead">{{ dicht.tekst }}</p>
        <button v-if="stand === 'fout'" type="button" class="knop zwart" @click="laad()">Opnieuw proberen</button>
      </div>
    </div>

    <template v-else>
      <header class="extern-kop">
        <div class="wrap">
          <div class="extern-balk">
            <BbdwLogo class="extern-logo" />
            <span class="tab nu">Geldig tot {{ geldigTot }}</span>
          </div>
          <p v-if="modus === 'proef'" class="melding">Proefversie van de projectkaart: dit zijn voorbeeldgegevens.</p>
          <p class="label">Open punten voor<template v-if="inhoud.leverancier.vak"> · {{ inhoud.leverancier.vak }}</template></p>
          <h1>{{ inhoud.leverancier.naam }}</h1>
          <p class="zin extern-zin">{{ zin }}</p>
          <p class="extern-uitleg">Dit vond BbDW bij de controle, en het staat nog open. Bij elk punt de foto en de plek op de tekening.</p>
          <div class="extern-acties">
            <div v-if="projecten.length > 1" class="seg extern-filter" role="group" aria-label="Welke projecten">
              <button type="button" :aria-pressed="keuze === 'alle'" @click="keuze = 'alle'">Alle projecten <span class="n">{{ aantal }}</span></button>
              <button v-for="p in projecten" :key="p.id" type="button" :aria-pressed="keuze === p.id" @click="keuze = p.id">{{ p.naam }} <span class="n">{{ p.punten.length }}</span></button>
            </div>
            <button type="button" class="knop" :disabled="pdfBezig" @click="pdf">
              {{ pdfBezig ? 'Pdf maken…' : keuze === 'alle' || projecten.length < 2 ? 'Pdf maken' : 'Pdf van dit project' }}
            </button>
          </div>
        </div>
      </header>

      <div class="wrap extern-lijst">
        <section v-for="p in zichtbaar" :key="p.id" class="kaart extern-project" :aria-labelledby="`project-${p.id}`">
          <span class="tab letop">{{ p.punten.length }} open</span>
          <div class="extern-project-kop">
            <div>
              <h2 :id="`project-${p.id}`">{{ p.naam }}</h2>
              <p v-if="waar(p)" class="klein">{{ waar(p) }}</p>
            </div>
            <button v-if="p.tekeningen.length" type="button" class="knop" @click="heleTekening(p)">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 15s5-4.6 5-8.5A5 5 0 0 0 3 6.5C3 10.4 8 15 8 15z" fill="none" stroke="currentColor" stroke-width="1.7" /><circle cx="8" cy="6.5" r="1.8" fill="currentColor" /></svg>
              Tekening met alle punten
            </button>
          </div>
          <ol class="extern-punten">
            <li v-for="punt in p.punten" :key="punt.id" class="extern-punt">
              <button type="button" class="duim" :aria-label="`Foto van punt ${punt.nummer} bekijken`" :disabled="!punt.foto" @click="toonFoto(punt)">
                <img v-if="punt.foto" :src="punt.foto" alt="" loading="lazy" @error="fotoFout">
              </button>
              <div class="extern-punt-tekst">
                <p class="notitie"><b class="punt-nr">#{{ punt.nummer }}</b> {{ punt.notitie }}</p>
                <small>Gemeld op {{ fmt(new Date(punt.aangemaakt_op)) }}<template v-if="punt.tekening_id"> · {{ tekeningTekst(punt) }}</template></small>
                <button v-if="punt.tekening_id" type="button" class="extern-plek" :aria-label="`Punt ${punt.nummer} op de tekening bekijken`" @click="opTekening(punt)">
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 15s5-4.6 5-8.5A5 5 0 0 0 3 6.5C3 10.4 8 15 8 15z" fill="none" stroke="currentColor" stroke-width="1.9" /><circle cx="8" cy="6.5" r="1.8" fill="currentColor" /></svg>
                  Op de tekening
                </button>
              </div>
            </li>
          </ol>
        </section>

        <footer class="extern-voet">
          <p>
            Deze pagina is van BbDW en alleen voor {{ inhoud.leverancier.naam }}. Hij gaat vanzelf dicht zodra alles is opgelost, en uiterlijk op {{ geldigTot }}.
            <template v-if="inhoud.gedeeld_door">Vragen over een punt? Neem contact op met {{ inhoud.gedeeld_door }} van BbDW.</template>
          </p>
          <button type="button" class="link" @click="vergeet">Code vergeten op dit apparaat</button>
        </footer>
      </div>
    </template>

    <TekeningViewer
      v-if="viewer" :tekeningen="viewerTekeningen" :tekening-id="viewer.tekeningId" :pins="viewerPins" :plek="plekVan(viewer.punt)"
      :actief="viewer.punt?.id ?? null" :titel="viewer.titel" :url-van="tekeningUrl" @sluit="viewer = null"
    />

    <dialog ref="venster" class="fotovenster" @close="groot = null" @click.self="venster?.close()">
      <figure v-if="groot">
        <img v-if="groot.foto" :src="groot.foto" :alt="groot.notitie">
        <figcaption><span class="notitie"><b class="punt-nr">#{{ groot.nummer }}</b> {{ groot.notitie }}</span><small>Gemeld op {{ fmt(new Date(groot.aangemaakt_op)) }}</small></figcaption>
      </figure>
      <button type="button" class="knop klein" @click="venster?.close()">Sluiten</button>
    </dialog>
  </main>
</template>

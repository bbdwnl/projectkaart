<script setup lang="ts">
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import type { Tekening } from '~/lib/types'
import { begrens, centreer, naarBlad, naarScherm, opBlad, passend, zichtbaarDeel, zoomRond, type BladPlek, type Beeld, type Maat, type Pin } from '~/lib/tekening'

// Een pdf-tekening schermvullend: slepen of met twee vingers schuiven en knijpen, scrollwiel of dubbeltik
// om te zoomen. Bij "markeren" zet een tik de plek die gecontroleerd moet worden.
//
// Schermvullend op een telefoon: iOS kent geen fullscreen voor gewone pagina's, dus de viewer neemt zelf
// het hele zichtbare scherm (100dvh, met de randen van de notch), zet het scrollen van de pagina en het
// eigen zoomen van de browser uit, en de terugknop of terugveeg sluit de viewer in plaats van de pagina.
// Waar de browser echt schermvullend kan (Android, computer) staat daar een knop voor.

type TekeningPlek = BladPlek & { tekening_id: string }

const props = withDefaults(defineProps<{
  tekeningen: Tekening[]
  /** De tekening waarmee de viewer opent (als er geen plek is meegegeven). */
  tekeningId: string
  pins?: Pin[]
  /** Openen in de stand waarin een tik de plek zet. */
  markeren?: boolean
  /** Mag de plek hier ook verplaatst worden (vanuit kijken)? */
  kanVerplaatsen?: boolean
  /** Hier gaat de viewer naartoe; bij markeren staat de plek er al. */
  plek?: TekeningPlek | null
  /** De pin waar het om gaat: valt op en staat onderin. */
  actief?: string | null
  titel?: string
}>(), { pins: () => [], markeren: false, kanVerplaatsen: false, plek: null, actief: null, titel: 'Tekening' })
const emit = defineEmits<{ sluit: [], kies: [plek: TekeningPlek] }>()
const bron = useBron()

const wortel = ref<HTMLElement>()
const vlak = ref<HTMLElement>()
const basisDoek = ref<HTMLCanvasElement>()
const detailDoek = ref<HTMLCanvasElement>()
const sluitKnop = ref<HTMLButtonElement>()

const huidigeId = ref(props.plek?.tekening_id ?? props.tekeningId)
const tekening = computed(() => props.tekeningen.find(t => t.id === huidigeId.value))
const stand = ref<'laden' | 'klaar' | 'fout'>('laden')
const fout = ref('')
const blad = ref(props.plek?.blad ?? 1)
const bladen = ref(1)
const modus = ref<'kijken' | 'markeren'>(props.markeren ? 'markeren' : 'kijken')
const marker = ref<TekeningPlek | null>(props.markeren && props.plek ? { ...props.plek } : null)
const gekozenPin = ref<string | null>(props.actief)

const maat = reactive<Maat>({ vlakB: 0, vlakH: 0, basisB: 0, basisH: 0 })
const beeld = reactive<Beeld>({ tx: 0, ty: 0, z: 1 })
const bladStijl = computed(() => ({ width: `${maat.basisB}px`, height: `${maat.basisH}px`, transform: `translate(${beeld.tx}px, ${beeld.ty}px) scale(${beeld.z})` }))
const ankerStijl = (p: { x: number, y: number }) => ({ left: `${p.x * maat.basisB}px`, top: `${p.y * maat.basisH}px`, transform: `scale(${1 / beeld.z})` })
const zichtbarePins = computed(() => props.pins.filter(p => p.tekening_id === huidigeId.value && p.blad === blad.value))
const infoPin = computed(() => props.pins.find(p => p.id === gekozenPin.value))
const markerHier = computed(() => marker.value && marker.value.tekening_id === huidigeId.value && marker.value.blad === blad.value ? marker.value : null)

// ---------- pdf laden en tekenen ----------
let laadTaak: PDFDocumentLoadingTask | null = null
let pdf: PDFDocumentProxy | null = null
let pagina: PDFPageProxy | null = null
let basisTaak: RenderTask | null = null
let detailTaak: RenderTask | null = null
let blobUrl: string | null = null
/** Pdf-punten naar schermpixels bij zoom 1. */
let basisSchaal = 1
let laadNummer = 0

async function laadTekening(id: string, startBlad = 1, focus?: { x: number, y: number }) {
  const t = props.tekeningen.find(x => x.id === id)
  if (!t) return
  const nummer = ++laadNummer
  stand.value = 'laden'
  try {
    const [pdfjs, url] = await Promise.all([laadPdfjs(), bron.tekeningUrl(t)])
    if (nummer !== laadNummer) return
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    blobUrl = url.startsWith('blob:') ? url : null
    await laadTaak?.destroy()
    laadTaak = pdfjs.getDocument({ url })
    pdf = await laadTaak.promise
    if (nummer !== laadNummer) return
    bladen.value = pdf.numPages
    await toonBlad(Math.min(Math.max(1, startBlad), pdf.numPages), focus)
    stand.value = 'klaar'
  } catch (e) {
    if (nummer !== laadNummer) return
    fout.value = foutTekst(e) || 'De tekening kon niet worden geopend.'
    stand.value = 'fout'
  }
}

async function toonBlad(n: number, focus?: { x: number, y: number } | 'behoud') {
  if (!pdf) return
  const midden = focus === 'behoud' && maat.basisB ? { ...naarBlad(beeld, maat, maat.vlakB / 2, maat.vlakH / 2), z: beeld.z } : null
  pagina = await pdf.getPage(n)
  blad.value = n
  const vp1 = pagina.getViewport({ scale: 1 })
  const p = passend(maat.vlakB, maat.vlakH, vp1.width, vp1.height)
  basisSchaal = p.schaal
  Object.assign(maat, { basisB: p.basisB, basisH: p.basisH })
  if (midden) Object.assign(beeld, begrens(centreer(maat, midden.x, midden.y, midden.z), maat))
  else if (focus && focus !== 'behoud') Object.assign(beeld, begrens(centreer(maat, focus.x, focus.y, 3), maat))
  else Object.assign(beeld, p.beeld)
  await tekenBasis()
  planDetail()
}

/** Het hele blad, scherp genoeg tot ongeveer twee keer zoom; daarboven tekent tekenDetail het stuk in beeld. */
async function tekenBasis() {
  const doek = basisDoek.value
  if (!pagina || !doek) return
  const vp1 = pagina.getViewport({ scale: 1 })
  const dpr = Math.min(devicePixelRatio || 1, 3)
  // Grenzen van canvas op telefoons: hooguit 4096 pixels per zijde en 16 miljoen in totaal.
  const s = Math.min(basisSchaal * dpr * 2, 4096 / vp1.width, 4096 / vp1.height, Math.sqrt(16e6 / (vp1.width * vp1.height)))
  const vp = pagina.getViewport({ scale: s })
  const tijdelijk = document.createElement('canvas')
  tijdelijk.width = Math.floor(vp.width)
  tijdelijk.height = Math.floor(vp.height)
  basisTaak?.cancel()
  basisTaak = pagina.render({ canvas: tijdelijk, viewport: vp })
  try {
    await basisTaak.promise
  } catch {
    return // afgebroken voor een nieuwe tekening
  }
  doek.width = tijdelijk.width
  doek.height = tijdelijk.height
  doek.getContext('2d')!.drawImage(tijdelijk, 0, 0)
}

// Ingezoomd: het stuk dat in beeld is opnieuw tekenen op de echte resolutie, als niemand meer schuift.
const detailStijl = ref<Record<string, string> | null>(null)
let detailKlok: ReturnType<typeof setTimeout> | undefined
function planDetail() {
  clearTimeout(detailKlok)
  detailKlok = setTimeout(tekenDetail, 180)
}
async function tekenDetail() {
  if (!pagina || wijzers.size || beeld.z < 1.6) return
  const deel = zichtbaarDeel(beeld, maat)
  if (!deel) return
  const dpr = Math.min(devicePixelRatio || 1, 3)
  const vp = pagina.getViewport({ scale: basisSchaal * beeld.z * dpr })
  const x0 = Math.floor(deel.x0 * vp.width), y0 = Math.floor(deel.y0 * vp.height)
  const b = Math.ceil((deel.x1 - deel.x0) * vp.width), h = Math.ceil((deel.y1 - deel.y0) * vp.height)
  if (b * h > 16e6) return
  const sleutel = `${beeld.tx},${beeld.ty},${beeld.z}`
  const tijdelijk = document.createElement('canvas')
  tijdelijk.width = b
  tijdelijk.height = h
  detailTaak?.cancel()
  detailTaak = pagina.render({ canvas: tijdelijk, viewport: vp, transform: [1, 0, 0, 1, -x0, -y0] })
  try {
    await detailTaak.promise
  } catch {
    return
  }
  const doek = detailDoek.value
  if (!doek || sleutel !== `${beeld.tx},${beeld.ty},${beeld.z}`) return
  doek.width = b
  doek.height = h
  doek.getContext('2d')!.drawImage(tijdelijk, 0, 0)
  const links = naarScherm(beeld, maat, x0 / vp.width, y0 / vp.height)
  detailStijl.value = { left: `${links.sx}px`, top: `${links.sy}px`, width: `${b / dpr}px`, height: `${h / dpr}px` }
}
watch(() => [beeld.tx, beeld.ty, beeld.z], () => {
  detailStijl.value = null
  planDetail()
})

// ---------- schuiven, knijpen, zoomen, tikken ----------
const wijzers = new Map<number, { x: number, y: number }>()
let begin: { x: number, y: number, t: number, verschoven: boolean } | null = null
let vorig: { mx: number, my: number, afstand: number } | null = null
let laatsteTik = { t: 0, x: 0, y: 0 }

function punt(e: { clientX: number, clientY: number }) {
  const r = vlak.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
function gebaar() {
  const ps = [...wijzers.values()]
  if (!ps.length) return null
  const mx = ps.reduce((s, p) => s + p.x, 0) / ps.length
  const my = ps.reduce((s, p) => s + p.y, 0) / ps.length
  return { mx, my, afstand: ps.length >= 2 ? Math.hypot(ps[0]!.x - ps[1]!.x, ps[0]!.y - ps[1]!.y) : 0 }
}
function zet(b: Beeld) {
  Object.assign(beeld, begrens(b, maat))
}

function neer(e: PointerEvent) {
  if (stand.value !== 'klaar' || (e.pointerType === 'mouse' && e.button !== 0)) return
  vlak.value?.setPointerCapture(e.pointerId)
  wijzers.set(e.pointerId, punt(e))
  if (wijzers.size === 1) begin = { ...punt(e), t: performance.now(), verschoven: false }
  else if (begin) begin.verschoven = true
  vorig = gebaar()
}
function beweeg(e: PointerEvent) {
  if (!wijzers.has(e.pointerId)) return
  wijzers.set(e.pointerId, punt(e))
  const nu = gebaar()!
  if (begin && Math.hypot(nu.mx - begin.x, nu.my - begin.y) > 8) begin.verschoven = true
  if (vorig) {
    let b: Beeld = { tx: beeld.tx + nu.mx - vorig.mx, ty: beeld.ty + nu.my - vorig.my, z: beeld.z }
    if (nu.afstand && vorig.afstand) b = zoomRond(b, nu.afstand / vorig.afstand, nu.mx, nu.my)
    zet(b)
  }
  vorig = nu
}
function op(e: PointerEvent) {
  if (!wijzers.has(e.pointerId)) return
  const p = punt(e)
  wijzers.delete(e.pointerId)
  if (!wijzers.size) {
    if (begin && !begin.verschoven && e.type === 'pointerup' && performance.now() - begin.t < 500) tik(p)
    begin = null
  }
  vorig = gebaar()
  planDetail()
}
function tik(p: { x: number, y: number }) {
  const nu = performance.now()
  const dubbel = nu - laatsteTik.t < 320 && Math.hypot(p.x - laatsteTik.x, p.y - laatsteTik.y) < 30
  laatsteTik = { t: dubbel ? 0 : nu, x: p.x, y: p.y }
  if (dubbel) {
    if (beeld.z >= 6) pasIn()
    else zet(zoomRond(beeld, 2.5, p.x, p.y))
    return
  }
  const b = naarBlad(beeld, maat, p.x, p.y)
  if (modus.value === 'markeren') {
    if (opBlad(b.x, b.y)) marker.value = { tekening_id: huidigeId.value, blad: blad.value, x: b.x, y: b.y }
    return
  }
  // Een pin aantikken: de pin heeft zijn punt onderaan, het rondje erboven.
  const raak = zichtbarePins.value
    .map(pin => ({ pin, s: naarScherm(beeld, maat, pin.x, pin.y) }))
    .map(r => ({ ...r, d: Math.hypot(r.s.sx - p.x, r.s.sy - 24 - p.y) }))
    .filter(r => r.d < 26)
    .sort((a, b) => a.d - b.d)[0]
  gekozenPin.value = raak?.pin.id ?? null
}
function wiel(e: WheelEvent) {
  if (stand.value !== 'klaar') return
  const p = punt(e)
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
  zet(zoomRond(beeld, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y))
}
const knopZoom = (f: number) => zet(zoomRond(beeld, f, maat.vlakB / 2, maat.vlakH / 2))
function pasIn() {
  if (!pagina) return
  const vp1 = pagina.getViewport({ scale: 1 })
  Object.assign(beeld, passend(maat.vlakB, maat.vlakH, vp1.width, vp1.height).beeld)
}
function naarBladNr(n: number) {
  if (pdf && n >= 1 && n <= pdf.numPages && n !== blad.value) toonBlad(n)
}

function toets(e: KeyboardEvent) {
  const pan = 80
  const acties: Record<string, () => void> = {
    'Escape': sluit, '+': () => knopZoom(1.6), '=': () => knopZoom(1.6), '-': () => knopZoom(1 / 1.6), '0': pasIn,
    'ArrowLeft': () => zet({ ...beeld, tx: beeld.tx + pan }), 'ArrowRight': () => zet({ ...beeld, tx: beeld.tx - pan }),
    'ArrowUp': () => zet({ ...beeld, ty: beeld.ty + pan }), 'ArrowDown': () => zet({ ...beeld, ty: beeld.ty - pan }),
  }
  const actie = acties[e.key]
  if (!actie || (e.key !== 'Escape' && ['SELECT', 'INPUT'].includes((e.target as HTMLElement).tagName))) return
  e.preventDefault()
  actie()
}

// ---------- vastleggen, sluiten ----------
function legVast() {
  if (!marker.value) return
  emit('kies', { ...marker.value })
  sluit()
}
let gesloten = false
/** Via de geschiedenis terug, zodat de terugknop en het kruisje hetzelfde doen. */
function sluit() {
  if (gesloten) return
  if (history.state?.tekeningViewer) history.back()
  else terug()
}
function terug() {
  if (gesloten) return
  gesloten = true
  emit('sluit')
}

// ---------- schermvullend ----------
const kanVolledig = ref(false)
const isVolledig = ref(false)
async function volledig() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await wortel.value?.requestFullscreen()
  } catch { /* niet toegestaan: de viewer vult het venster al */ }
}
const volledigWissel = () => (isVolledig.value = !!document.fullscreenElement)
const voorkomZoom = (e: Event) => e.preventDefault()

let waarnemer: ResizeObserver | undefined
let schaalKlok: ReturnType<typeof setTimeout> | undefined
let vorigeOverflow = ''
onMounted(() => {
  kanVolledig.value = !!document.fullscreenEnabled
  vorigeOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
  document.addEventListener('gesturestart', voorkomZoom, { passive: false } as AddEventListenerOptions)
  document.addEventListener('gesturechange', voorkomZoom, { passive: false } as AddEventListenerOptions)
  document.addEventListener('fullscreenchange', volledigWissel)
  // Op het hele document: na een klik op de tekening staat de focus niet meer op een knop.
  document.addEventListener('keydown', toets)
  history.pushState({ ...history.state, tekeningViewer: true }, '')
  addEventListener('popstate', terug)
  sluitKnop.value?.focus()

  const r = vlak.value!.getBoundingClientRect()
  Object.assign(maat, { vlakB: r.width, vlakH: r.height })
  waarnemer = new ResizeObserver(([e]) => {
    const { width, height } = e!.contentRect
    if (Math.abs(width - maat.vlakB) < 1 && Math.abs(height - maat.vlakH) < 1) return
    clearTimeout(schaalKlok)
    schaalKlok = setTimeout(() => {
      if (!pagina) return Object.assign(maat, { vlakB: width, vlakH: height })
      const midden = { ...naarBlad(beeld, maat, maat.vlakB / 2, maat.vlakH / 2), z: beeld.z }
      Object.assign(maat, { vlakB: width, vlakH: height })
      const vp1 = pagina.getViewport({ scale: 1 })
      const p = passend(width, height, vp1.width, vp1.height)
      basisSchaal = p.schaal
      Object.assign(maat, { basisB: p.basisB, basisH: p.basisH })
      zet(centreer(maat, midden.x, midden.y, midden.z))
      tekenBasis()
    }, 120)
  })
  waarnemer.observe(vlak.value!)

  laadTekening(huidigeId.value, blad.value, props.plek && props.plek.tekening_id === huidigeId.value ? { x: props.plek.x, y: props.plek.y } : undefined)
})
watch(huidigeId, id => {
  gekozenPin.value = null
  laadTekening(id)
})
onBeforeUnmount(() => {
  clearTimeout(detailKlok)
  clearTimeout(schaalKlok)
  waarnemer?.disconnect()
  basisTaak?.cancel()
  detailTaak?.cancel()
  laadTaak?.destroy()
  if (blobUrl) URL.revokeObjectURL(blobUrl)
  document.documentElement.style.overflow = vorigeOverflow
  document.removeEventListener('gesturestart', voorkomZoom)
  document.removeEventListener('gesturechange', voorkomZoom)
  document.removeEventListener('fullscreenchange', volledigWissel)
  document.removeEventListener('keydown', toets)
  removeEventListener('popstate', terug)
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
  // Gesloten door de pagina zelf (niet via terug): de stap in de geschiedenis weer weghalen.
  if (!gesloten && history.state?.tekeningViewer) history.back()
})
</script>

<template>
  <Teleport to="body">
    <div ref="wortel" class="viewer" role="dialog" aria-modal="true" tabindex="-1" :aria-label="`Tekening: ${tekening?.naam ?? ''}`">
      <header class="viewer-kop">
        <div class="viewer-titel">
          <span class="label">{{ titel }}</span>
          <select v-if="tekeningen.length > 1" v-model="huidigeId" class="viewer-keuze" aria-label="Tekening">
            <option v-for="t in tekeningen" :key="t.id" :value="t.id">{{ t.naam }}</option>
          </select>
          <b v-else>{{ tekening?.naam }}</b>
        </div>
        <button ref="sluitKnop" type="button" class="viewer-sluit" aria-label="Tekening sluiten" @click="sluit">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
        </button>
      </header>

      <div
        ref="vlak" class="viewer-vlak" :class="{ markeren: modus === 'markeren' }"
        @pointerdown="neer" @pointermove="beweeg" @pointerup="op" @pointercancel="op" @wheel.prevent="wiel"
      >
        <div class="viewer-blad" :style="bladStijl">
          <canvas ref="basisDoek" class="viewer-doek" />
        </div>
        <canvas v-show="detailStijl" ref="detailDoek" class="viewer-detail" :style="detailStijl ?? {}" />
        <!-- Pins en de plek in een eigen laag, boven de scherpe uitsnede. -->
        <div class="viewer-lagen" :style="bladStijl" aria-hidden="true">
          <span v-for="p in zichtbarePins" :key="p.id" class="pin-anker" :style="ankerStijl(p)">
            <span class="viewer-pin" :class="{ opgelost: p.opgelost, actief: p.id === actief || p.id === gekozenPin }">{{ p.label }}</span>
          </span>
          <span v-if="markerHier" class="pin-anker" :style="ankerStijl(markerHier)"><span class="viewer-marker" /></span>
        </div>
        <div v-if="stand === 'laden'" class="viewer-melding">Tekening laden…</div>
        <div v-else-if="stand === 'fout'" class="viewer-melding">{{ fout }}</div>
        <p v-else-if="modus === 'markeren'" class="viewer-hint">{{ marker ? 'Tik opnieuw om de plek te verschuiven' : 'Tik op de plek die gecontroleerd moet worden' }}</p>
        <p v-else-if="infoPin" class="viewer-hint viewer-info"><b>#{{ infoPin.label }}</b> {{ infoPin.tekst }}</p>
      </div>

      <footer class="viewer-voet">
        <div class="viewer-groep">
          <button type="button" aria-label="Uitzoomen" @click="knopZoom(1 / 1.6)">−</button>
          <button type="button" @click="pasIn">Passend</button>
          <button type="button" aria-label="Inzoomen" @click="knopZoom(1.6)">+</button>
        </div>
        <div v-if="bladen > 1" class="viewer-groep">
          <button type="button" aria-label="Vorig blad" :disabled="blad <= 1" @click="naarBladNr(blad - 1)">‹</button>
          <span class="viewer-blad-nr">Blad {{ blad }}/{{ bladen }}</span>
          <button type="button" aria-label="Volgend blad" :disabled="blad >= bladen" @click="naarBladNr(blad + 1)">›</button>
        </div>
        <button v-if="kanVolledig" type="button" class="viewer-volledig" :aria-pressed="isVolledig" @click="volledig">{{ isVolledig ? 'Schermvullend uit' : 'Schermvullend' }}</button>
        <div class="viewer-acties">
          <button v-if="kanVerplaatsen && modus === 'kijken'" type="button" class="knop klein" @click="modus = 'markeren'; marker = plek ? { ...plek } : null">Plek verplaatsen</button>
          <button v-if="modus === 'markeren'" type="button" class="knop" :disabled="!marker" @click="legVast">Plek vastleggen</button>
        </div>
      </footer>
    </div>
  </Teleport>
</template>

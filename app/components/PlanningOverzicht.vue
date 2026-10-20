<script setup lang="ts">
import type { Fase, Project } from '~/lib/types'
import { faseInfo, ROLLEN } from '~/lib/fasen'
import { begin, bezetting, LAAG_FASEN, planRegels, STAPPEN, tijdas, type Laag, type PlanRegel, type Segment } from '~/lib/planning'
import { fmt, vandaag } from '~/lib/datum'

// Het planningsoverzicht: per verantwoordelijke de projecten onder elkaar in de tijd, met bovenaan per maand hoeveel
// er lopen. Op Haalbaarheid twee lagen (prognose en lopend) om de overlap te zien; op Projecten een filter op fase.
const props = defineProps<{
  projecten: Project[]
  /** De lagen die je aan en uit kunt zetten; de eerste staat bovenaan in de legenda. */
  lagen: Laag[]
  /** Filter op ontwikkeling, uitvoering en nazorg. */
  fasefilter?: boolean
}>()

const nu = vandaag()
const LAAG_NAAM: Record<Laag, string> = { lopend: 'Lopende projecten', prognose: 'Prognose haalbaarheid' }
const aan = reactive<Record<Laag, boolean>>({ lopend: true, prognose: true })
const fase = ref<Fase | 'alle'>('alle')
const wie = ref('alle')

const alle = computed(() => planRegels(props.projecten, nu).filter(r => props.lagen.includes(r.laag)))
// Alles wat bij het aan- en uitzetten op zijn plek moet blijven (de tijdas, de knoppen per persoon) rekent met alle
// regels, niet met wat er nu in beeld is. Zo verspringt er niets onder je muis.
const as = computed(() => tijdas(alle.value.filter(r => r.segmenten.length), nu))
/** Alleen wat nog in beeld komt: een project dat al voor de tijdas klaar was, valt weg. */
const inTijd = (r: PlanRegel) => r.segmenten.some(s => s.tot > as.value.van)
/** Wat door de lagen en de fase komt; daaruit tellen de knoppen van de verantwoordelijke. */
const inBeeld = computed(() => alle.value.filter(r => aan[r.laag] && (fase.value === 'alle' || r.p.fase === fase.value)))
const metDatums = computed(() => inBeeld.value.filter(inTijd))

const wieVan = (r: PlanRegel) => r.wie ?? 'geen'
/** Iedereen die er kan staan, ook met 0 in deze selectie: de knoppen blijven op hun plek. */
const mensen = computed(() => {
  const namen = new Set(alle.value.filter(inTijd).map(wieVan))
  if (wie.value !== 'alle') namen.add(wie.value)
  return [...namen]
    .sort((a, b) => Number(a === 'geen') - Number(b === 'geen') || a.localeCompare(b, 'nl'))
    .map(id => ({ id, naam: id === 'geen' ? 'Zonder' : id, aantal: metDatums.value.filter(r => wieVan(r) === id).length }))
})
const fasen = computed(() => LAAG_FASEN.lopend.map(f => ({ id: f, naam: faseInfo(f).naam, aantal: alle.value.filter(r => r.p.fase === f && r.segmenten.length).length })))

const vanWie = (r: PlanRegel) => wie.value === 'alle' || wieVan(r) === wie.value
const gekozen = computed(() => metDatums.value.filter(vanWie))
const zonderDatums = computed(() => inBeeld.value.filter(r => !r.segmenten.length && vanWie(r)))
const opStart = (a: PlanRegel, b: PlanRegel) => begin(a) - begin(b) || a.p.naam.localeCompare(b.p.naam, 'nl')
/** Bij iedereen: per persoon een groep; bij één persoon: alles onder elkaar, op start. */
const groepen = computed(() => {
  if (wie.value !== 'alle') return [{ id: wie.value, naam: '', regels: [...gekozen.value].sort(opStart) }]
  return mensen.value.filter(m => m.aantal).map(m => ({ id: m.id, naam: m.naam === 'Zonder' ? 'Nog niemand gekozen' : m.naam, regels: gekozen.value.filter(r => wieVan(r) === m.id).sort(opStart) }))
})
const telling = (regels: PlanRegel[]) => props.lagen
  .map(l => [l, regels.filter(r => r.laag === l).length] as const)
  .filter(([, n]) => n)
  .map(([l, n]) => `${n} ${l}`)
  .join(' · ')

const maanden = computed(() => bezetting(gekozen.value, as.value.maanden))
const hoogste = computed(() => Math.max(1, ...maanden.value.map(m => m.lopend + m.prognose)))
const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const maandNaam = (d: Date) => (d.getMonth() === 0 ? `${MAAND[0]} ’${String(d.getFullYear()).slice(2)}` : MAAND[d.getMonth()]!)
const breedte = (d: Date) => as.value.pos(new Date(d.getFullYear(), d.getMonth() + 1, 1)) - as.value.pos(d)
const vandaagPos = computed(() => as.value.pos(nu))

const onder = (r: PlanRegel) => [faseInfo(r.p.fase).naam, r.laag === 'prognose' ? 'prognose' : null, ROLLEN[r.rol].kort].filter(Boolean).join(' · ')
const segTekst = (r: PlanRegel, s: Segment) => `${r.p.naam}, ${r.laag === 'prognose' ? 'prognose ' : ''}${s.naam.toLowerCase()}: ${fmt(s.van)} tot ${fmt(s.tot)}`

// Eén tooltip voor het hele overzicht, bij de muis.
const doos = ref<HTMLElement>()
const tip = ref<{ x: number, y: number, kop: string, waarde: string, onder: string } | null>(null)
function toon(e: PointerEvent, kop: string, waarde: string, onder: string) {
  const r = doos.value?.getBoundingClientRect()
  if (r) tip.value = { x: e.clientX - r.left, y: e.clientY - r.top, kop, waarde, onder }
}
const toonSeg = (e: PointerEvent, r: PlanRegel, s: Segment) =>
  toon(e, r.p.naam, `${fmt(s.van)} – ${fmt(s.tot)}`, `${r.laag === 'prognose' ? 'Prognose · ' : ''}${s.naam}`)
const toonMaand = (e: PointerEvent, m: { maand: Date, lopend: number, prognose: number }) =>
  toon(e, `${MAAND[m.maand.getMonth()]} ${m.maand.getFullYear()}`, `${m.lopend + m.prognose} ${m.lopend + m.prognose === 1 ? 'project' : 'projecten'}`,
    props.lagen.length > 1 ? `${m.lopend} lopend · ${m.prognose} prognose in de bouw` : 'lopend in deze maand')
</script>

<template>
  <div ref="doos" class="plan" @pointerleave="tip = null">
    <div class="filters projectfilters">
      <div class="filtergroep">
        <span class="label">Verantwoordelijke</span>
        <div class="seg" role="group" aria-label="Verantwoordelijke">
          <button type="button" :aria-pressed="wie === 'alle'" @click="wie = 'alle'">Iedereen <span class="n">{{ metDatums.length }}</span></button>
          <button v-for="m in mensen" :key="m.id" type="button" :aria-pressed="wie === m.id" @click="wie = m.id">{{ m.naam }} <span class="n">{{ m.aantal }}</span></button>
        </div>
      </div>
      <div v-if="fasefilter" class="filtergroep">
        <span class="label">Fase</span>
        <div class="seg" role="group" aria-label="Fase">
          <button type="button" :aria-pressed="fase === 'alle'" @click="fase = 'alle'">Alle</button>
          <button v-for="f in fasen" :key="f.id" type="button" :aria-pressed="fase === f.id" @click="fase = f.id">{{ f.naam }} <span class="n">{{ f.aantal }}</span></button>
        </div>
      </div>
      <div v-if="lagen.length > 1" class="filtergroep">
        <span class="label">Lagen</span>
        <label v-for="l in lagen" :key="l" class="schakel"><input v-model="aan[l]" type="checkbox"><span />{{ LAAG_NAAM[l] }}</label>
      </div>
    </div>

    <div class="plan-legenda">
      <template v-for="l in lagen" :key="l">
        <span class="plan-legenda-laag" :class="{ uit: !aan[l] }">
          <b>{{ lagen.length > 1 ? LAAG_NAAM[l] : 'Fase in de tijd' }}</b>
          <span v-for="(naam, i) in STAPPEN[l]" :key="i"><i :class="`plan-${l}-${i}`" />{{ naam }}</span>
        </span>
      </template>
      <span><i class="plan-legenda-vandaag" />Vandaag</span>
    </div>

    <div v-if="metDatums.length" class="plan-scroll">
      <div class="plan-in">
        <div class="plan-rij plan-kop">
          <div class="plan-lbl"><small>{{ as.van.getFullYear() }}–{{ as.tot.getFullYear() }}</small></div>
          <div class="plan-spoor">
            <template v-for="m in as.maanden" :key="m.getTime()">
              <i class="plan-raster" :class="{ jaar: m.getMonth() === 0 }" :style="{ left: `${as.pos(m)}%` }" />
              <span class="plan-maand" :class="{ jaar: m.getMonth() === 0 }" :style="{ left: `${as.pos(m)}%` }">{{ maandNaam(m) }}</span>
            </template>
            <span class="plan-vandaag-tekst" :style="{ left: `${vandaagPos}%` }">Vandaag</span>
          </div>
        </div>
        <div class="plan-rij plan-last">
          <div class="plan-lbl"><b>Lopend per maand</b><small>{{ wie === 'alle' ? 'iedereen' : mensen.find(m => m.id === wie)?.naam }}{{ lagen.length > 1 && aan.prognose ? ', prognose vanaf start casco' : '' }}</small></div>
          <div class="plan-spoor">
            <i v-for="m in as.maanden" :key="m.getTime()" class="plan-raster" :class="{ jaar: m.getMonth() === 0 }" :style="{ left: `${as.pos(m)}%` }" />
            <i class="plan-vandaag" :style="{ left: `${vandaagPos}%` }" />
            <div
              v-for="m in maanden" :key="m.maand.getTime()" class="plan-kolom"
              :style="{ left: `calc(${as.pos(m.maand)}% + 2px)`, width: `calc(${breedte(m.maand)}% - 4px)` }"
              :aria-label="`${MAAND[m.maand.getMonth()]} ${m.maand.getFullYear()}: ${m.lopend} lopend${lagen.length > 1 ? `, ${m.prognose} prognose` : ''}`"
              role="img" @pointermove="e => toonMaand(e, m)" @pointerleave="tip = null"
            >
              <i v-if="m.lopend" class="plan-lopend-1" :style="{ height: `${m.lopend / hoogste * 38}px` }" />
              <i v-if="m.prognose" class="plan-prognose-1" :style="{ height: `${m.prognose / hoogste * 38}px` }" />
              <small v-if="m.lopend + m.prognose">{{ m.lopend + m.prognose }}</small>
            </div>
          </div>
        </div>

        <template v-for="g in groepen" :key="g.id">
          <div v-if="g.naam" class="plan-groep">{{ g.naam }}<small>{{ telling(g.regels) }}</small></div>
          <div v-for="r in g.regels" :key="r.p.id" class="plan-rij" :class="`laag-${r.laag}`">
            <div class="plan-lbl">
              <NuxtLink :to="`/projecten/${r.p.slug}#proces`">{{ r.p.naam }}</NuxtLink>
              <small>{{ onder(r) }}</small>
            </div>
            <div class="plan-spoor">
              <i v-for="m in as.maanden" :key="m.getTime()" class="plan-raster" :class="{ jaar: m.getMonth() === 0 }" :style="{ left: `${as.pos(m)}%` }" />
              <i class="plan-vandaag" :style="{ left: `${vandaagPos}%` }" />
              <i
                v-for="(s, i) in r.segmenten.filter(x => x.tot > as.van)" :key="i" class="plan-seg" :class="`plan-${r.laag}-${s.stap}`"
                :style="{ left: `${as.pos(s.van)}%`, width: `max(3px, calc(${as.pos(s.tot) - as.pos(s.van)}% - 2px))` }"
                role="img" :aria-label="segTekst(r, s)"
                @pointermove="e => toonSeg(e, r, s)" @pointerleave="tip = null"
              />
            </div>
          </div>
        </template>
        <p v-if="zonderDatums.length" class="plan-zonder"><b>Zonder datums</b> (niet in de balk): {{ zonderDatums.map(r => r.p.naam).join(' · ') }}</p>
      </div>
    </div>
    <p v-else class="leeg-staat">Geen projecten met datums in deze selectie.{{ zonderDatums.length ? ` Zonder datums: ${zonderDatums.map(r => r.p.naam).join(', ')}.` : '' }}</p>

    <div v-if="tip" class="plan-tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }">
      <strong>{{ tip.waarde }}</strong>
      <span>{{ tip.onder }}</span>
      <span>{{ tip.kop }}</span>
    </div>
  </div>
</template>

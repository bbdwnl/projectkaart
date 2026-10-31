<script setup lang="ts">
import type { Fase, Project } from '~/lib/types'
import { FASEN, faseInfo, faseKleur, ROLLEN, SUBFASEN } from '~/lib/fasen'
import { begin, bezetting, LAAG_FASEN, planRegels, tijdas, type Laag, type PlanRegel, type Segment } from '~/lib/planning'
import { fmt, vandaag } from '~/lib/datum'

// Het planningsoverzicht: per verantwoordelijke de projecten onder elkaar in de tijd, met bovenaan per maand hoeveel
// er lopen. Op Projecten twee lagen (prognose van haalbaarheid en lopend) om de overlap te zien, en een filter op fase.
const props = defineProps<{
  projecten: Project[]
  /** De lagen die je aan en uit kunt zetten; de eerste staat bovenaan in de legenda. */
  lagen: Laag[]
  /** Filter op de fasen van de lagen: haalbaarheid (prognose), ontwikkeling, uitvoering en nazorg. */
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
    .map(id => ({
      id, naam: id === 'geen' ? 'Zonder' : id,
      aantal: metDatums.value.filter(r => wieVan(r) === id && !r.buddy).length,
      buddy: metDatums.value.filter(r => wieVan(r) === id && r.buddy).length,
    }))
})
const fasen = computed(() => FASEN.map(f => f.id).filter(f => props.lagen.some(l => LAAG_FASEN[l].includes(f))).map(f => ({ id: f, naam: faseInfo(f).naam, kleur: faseKleur(f), aantal: alle.value.filter(r => r.p.fase === f && r.segmenten.length).length })))

const vanWie = (r: PlanRegel) => wie.value === 'alle' || wieVan(r) === wie.value
const gekozen = computed(() => metDatums.value.filter(vanWie))
const zonderDatums = computed(() => inBeeld.value.filter(r => !r.segmenten.length && !r.buddy && vanWie(r)))
const opStart = (a: PlanRegel, b: PlanRegel) => begin(a) - begin(b) || a.p.naam.localeCompare(b.p.naam, 'nl')
/** Bij iedereen: per persoon een groep; bij één persoon: alles onder elkaar, op start. */
const groepen = computed(() => {
  if (wie.value !== 'alle') return [{ id: wie.value, naam: '', regels: [...gekozen.value].sort(opStart) }]
  return mensen.value.filter(m => m.aantal + m.buddy).map(m => ({ id: m.id, naam: m.naam === 'Zonder' ? 'Nog niemand gekozen' : m.naam, regels: gekozen.value.filter(r => wieVan(r) === m.id).sort(opStart) }))
})
const telling = (regels: PlanRegel[]) => [
  ...props.lagen.map(l => [l, regels.filter(r => r.laag === l && !r.buddy).length] as const),
  ['als buddy', regels.filter(r => r.buddy).length] as const,
].filter(([, n]) => n).map(([l, n]) => `${n} ${l}`).join(' · ')

const maanden = computed(() => bezetting(gekozen.value, as.value.maanden))
const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const maandNaam = (d: Date) => (d.getMonth() === 0 ? `${MAAND[0]} ’${String(d.getFullYear()).slice(2)}` : MAAND[d.getMonth()]!)
const breedte = (d: Date) => as.value.pos(new Date(d.getFullYear(), d.getMonth() + 1, 1)) - as.value.pos(d)
const vandaagPos = computed(() => as.value.pos(nu))

const onder = (r: PlanRegel) => [
  faseInfo(r.p.fase).naam + (r.p.subfase ? ` ${SUBFASEN.find(s => s.id === r.p.subfase)?.naam}` : ''),
  r.laag === 'prognose' ? 'prognose' : null,
  r.buddy ? `buddy, ${ROLLEN[r.rol].kort} ${r.p[r.rol] ?? 'nog niemand'}` : ROLLEN[r.rol].kort,
  r.p.prio ? 'prio' : null,
].filter(Boolean).join(' · ')
const segTekst = (r: PlanRegel, s: Segment) => `${r.p.naam}, ${r.laag === 'prognose' ? 'prognose ' : ''}${s.naam.toLowerCase()}: ${fmt(s.van)} tot ${fmt(s.tot)}`
</script>

<template>
  <div class="plan">
    <div class="filters projectfilters">
      <div class="filtergroep">
        <span class="label">Verantwoordelijke</span>
        <div class="seg" role="group" aria-label="Verantwoordelijke">
          <button type="button" :aria-pressed="wie === 'alle'" @click="wie = 'alle'">Iedereen <span class="n">{{ metDatums.length }}</span></button>
          <button v-for="m in mensen" :key="m.id" type="button" :aria-pressed="wie === m.id" @click="wie = m.id">{{ m.naam }} <span class="n">{{ m.aantal }}{{ m.buddy ? ` +${m.buddy}` : '' }}</span></button>
        </div>
      </div>
      <div v-if="fasefilter" class="filtergroep">
        <span class="label">Fase</span>
        <div class="seg" role="group" aria-label="Fase">
          <button type="button" :aria-pressed="fase === 'alle'" @click="fase = 'alle'">Alle</button>
          <button v-for="f in fasen" :key="f.id" type="button" :aria-pressed="fase === f.id" @click="fase = f.id"><i class="fase-stip" :style="{ background: f.kleur }" aria-hidden="true"/>{{ f.naam }} <span class="n">{{ f.aantal }}</span></button>
        </div>
      </div>
      <!-- Met een fasefilter zijn de lagen dubbel: de prognose is de fase haalbaarheid. -->
      <div v-if="lagen.length > 1 && !fasefilter" class="filtergroep">
        <span class="label">Lagen</span>
        <label v-for="l in lagen" :key="l" class="schakel"><input v-model="aan[l]" type="checkbox"><span />{{ LAAG_NAAM[l] }}</label>
      </div>
    </div>

    <div class="plan-legenda">
      <span class="plan-legenda-laag">
        <b>Fase in de tijd</b>
        <span v-for="f in LAAG_FASEN.lopend" :key="f"><i class="fase-stip" :style="{ background: faseKleur(f) }" />{{ faseInfo(f).naam }}</span>
      </span>
      <span v-if="lagen.length > 1" class="plan-legenda-laag">
        <b>Prognose</b>
        <span v-for="f in LAAG_FASEN.prognose" :key="f"><i class="fase-stip" :style="{ background: faseKleur(f) }" />{{ faseInfo(f).naam }}</span>
      </span>
      <span><i class="plan-legenda-open" />Nog geen opleverdatum</span>
      <span><i class="plan-legenda-buddy" />Als buddy (telt niet mee)</span>
      <span><i class="plan-legenda-prio" />Prio</span>
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
              role="img"
            >
              <small v-if="m.lopend + m.prognose" class="plan-maand-getal">{{ m.lopend + m.prognose }}</small>
            </div>
          </div>
        </div>

        <template v-for="g in groepen" :key="g.id">
          <div v-if="g.naam" class="plan-groep">{{ g.naam }}<small>{{ telling(g.regels) }}</small></div>
          <div v-for="r in g.regels" :key="`${r.p.id}${r.buddy ? '-buddy' : ''}`" class="plan-rij" :class="[`laag-${r.laag}`, { buddy: r.buddy, prio: r.p.prio }]">
            <div class="plan-lbl">
              <b class="plan-rij-kleur"><i class="fase-stip" :style="{ background: faseKleur(r.p.fase) }" aria-hidden="true"/><NuxtLink :to="`/projecten/${r.p.slug}#proces`">{{ r.p.naam }}</NuxtLink></b>
              <small>{{ onder(r) }}</small>
            </div>
            <div class="plan-spoor">
              <i v-for="m in as.maanden" :key="m.getTime()" class="plan-raster" :class="{ jaar: m.getMonth() === 0 }" :style="{ left: `${as.pos(m)}%` }" />
              <i class="plan-vandaag" :style="{ left: `${vandaagPos}%` }" />
              <i
                v-for="(s, i) in r.segmenten.filter(x => x.tot > as.van)" :key="i" class="plan-seg" :class="{ open: s.open }"
                :style="{ background: faseKleur(r.p.fase), opacity: 1 - i * 0.2, left: `${as.pos(s.van)}%`, width: `max(3px, calc(${as.pos(s.tot) - as.pos(s.van)}% - 2px))` }"
                role="img" :aria-label="segTekst(r, s)"
              />
            </div>
          </div>
        </template>
        <p v-if="zonderDatums.length" class="plan-zonder"><b>Zonder datums</b> (niet in de balk): {{ zonderDatums.map(r => r.p.naam).join(' · ') }}</p>
      </div>
    </div>
    <p v-else class="leeg-staat">Geen projecten met datums in deze selectie.{{ zonderDatums.length ? ` Zonder datums: ${zonderDatums.map(r => r.p.naam).join(', ')}.` : '' }}</p>
  </div>
</template>

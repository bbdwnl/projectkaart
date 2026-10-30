<script setup lang="ts">
import { DATUMVELDEN, DATUM_BIJ_FASE, EISEN, FASEN, faseIndex, PROGNOSEVELDEN, ROLLEN } from '~/lib/fasen'
import { eisStand } from '~/lib/stoplicht'
import { fmt, naarDatum } from '~/lib/datum'
import type { Fase, Licht, ProjectDatums, ProjectPrognose, Rol } from '~/lib/types'

// Eén tijdlijn voor het hele proces: de fasen met hun overdrachtspunten én de harde datums bij elkaar.
// De datum van een fase is de mijlpaal waar die fase naartoe werkt. Klik op een datum om hem te wijzigen.
const { project, taken, nu } = useKaart()
const { weergave } = useWeergave()
const w = computed(() => weergave.value.proces)

interface DatumKnop { veld: keyof ProjectDatums | keyof ProjectPrognose, naam: string, kort: string, waarde: string | null }
interface Stop {
  id: Fase
  naam: string
  rol: Rol
  wat: string
  kleur: string
  stand: 'af' | 'nu' | 'straks'
  datums: DatumKnop[]
  kop: string
  punten: { titel: string, licht: Licht }[]
}

const fi = computed(() => faseIndex(project.value!.fase))
const voortgang = computed(() => fi.value / (FASEN.length - 1))

const stops = computed<Stop[]>(() => {
  const p = project.value
  if (!p) return []
  const nuIndex = fi.value
  return FASEN.map((f, i) => {
    const datums = (DATUM_BIJ_FASE[f.id] ?? [])
      .map(veld => DATUMVELDEN.find(d => d.veld === veld))
      .filter((d): d is typeof DATUMVELDEN[number] => !!d)
      .map(d => ({ ...d, waarde: p[d.veld] }))
    return {
      ...f,
      stand: i < nuIndex ? 'af' : i === nuIndex ? 'nu' : 'straks',
      datums,
      kop: EISEN[f.id].kop,
      punten: EISEN[f.id].items.map(e => ({ titel: e.titel, licht: eisStand(e.taken, p, taken.value, nu) })),
    }
  })
})

/** De prognose telt alleen in lead en haalbaarheid (of als er al een prognosedatum staat). */
const prognose = computed<DatumKnop[]>(() => PROGNOSEVELDEN.map(d => ({ ...d, kort: d.naam, waarde: project.value?.[d.veld] ?? null })))
const metPrognose = computed(() => !!project.value && (
  project.value.fase === 'lead' || project.value.fase === 'haalbaarheid' || PROGNOSEVELDEN.some(d => project.value![d.veld])))

const bewerken = ref<{ veld: keyof ProjectDatums | keyof ProjectPrognose, naam: string, waarde: string | null, prognose: boolean } | null>(null)
const bewerk = (d: DatumKnop) => (bewerken.value = { veld: d.veld, naam: d.naam, waarde: d.waarde, prognose: false })
const bewerkPrognose = (d: DatumKnop) => (bewerken.value = { veld: d.veld, naam: d.naam, waarde: d.waarde, prognose: true })

const WOORD: Record<Licht, string> = { telaat: 'Te laat', letop: 'Let op', klaar: 'Klaar', later: 'N.v.t.', open: 'Open' }

const getekend = ref(false)
onMounted(async () => {
  await volgendBeeld()
  getekend.value = true
})
</script>

<template>
  <div class="tijdlijn gecombineerd" :class="{ klaar: getekend }">
    <div v-if="w.flow" class="banden">
      <div class="band" style="grid-column:1/3"><b>AM</b> · accountmanager</div>
      <div class="band"><b>PO</b> · projectontwikkelaar</div>
      <div class="band" style="grid-column:4/6"><b>PM</b> · projectmanager</div>
    </div>

    <div v-if="w.tijdlijn" class="spoor">
      <div class="lijn"><i :style="{ transform: `scaleX(${getekend ? voortgang : 0})` }" /></div>
      <div v-for="(f, i) in stops" :key="f.id" class="stop">
        <span class="knoopplek">
          <i class="knoop" :class="{ af: f.stand === 'af', nu: f.stand === 'nu' }" :style="{ transitionDelay: `${300 + i * 140}ms` }" />
        </span>
        <span v-if="w.datums" class="stop-datums">
          <button
            v-for="d in f.datums" :key="d.veld" type="button" class="stop-datum" :class="{ leeg: !d.waarde }"
            :aria-label="`${d.naam} wijzigen`" @click="bewerk(d)"
          >
            <span class="stop-datum-naam">{{ d.kort }}</span><b class="n" :class="{ leeg: !d.waarde }">{{ d.waarde ? fmt(naarDatum(d.waarde)) : '—' }}</b>
            <svg class="bewerk-icoon" width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 1.7a1.6 1.6 0 0 1 2.3 0l.7.7a1.6 1.6 0 0 1 0 2.3l-8 8-3.4 1.1 1.1-3.4 8-8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>
          </button>
          <span v-if="!f.datums.length" class="stop-datum leeg"><b>—</b></span>
        </span>
      </div>
    </div>

    <div class="fasen">
      <div v-for="f in stops" :key="f.id" class="fase" :class="f.stand">
        <div v-if="w.flow" class="kaart til">
          <StatusTab :licht="f.stand === 'af' ? 'klaar' : f.stand === 'nu' ? 'nu' : 'later'" :woord="f.stand === 'af' ? 'Afgerond' : f.stand === 'nu' ? 'Nu' : 'Straks'" />
          <span class="rol">{{ ROLLEN[f.rol].kort }}</span>
          <h3><i class="fase-stip" :style="{ background: f.kleur }" aria-hidden="true"/>{{ f.naam }}</h3>
          <p>{{ f.wat }}</p>
        </div>

        <div v-if="w.flow" class="eis">
          <h4>{{ f.kop }}</h4>
          <ul>
            <li v-for="p in f.punten" :key="p.titel">
              <i class="punt" :class="p.licht === 'open' ? '' : p.licht" :title="WOORD[p.licht]" />
              <span>{{ p.titel }}<span class="verborgen"> ({{ WOORD[p.licht] }})</span></span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <section v-if="w.datums && metPrognose" class="prognose">
      <p class="label">Prognose</p>
      <p class="klein">Wanneer de bouw naar verwachting start en klaar is. Staat in het planningsoverzicht van Haalbaarheid, naast de lopende projecten.</p>
      <div class="fase-datums prognose-datums">
        <button
          v-for="d in prognose" :key="d.veld" type="button" class="datumknop prognoseknop" :class="{ leeg: !d.waarde }"
          :aria-label="`Prognose ${d.naam.toLowerCase()} wijzigen`" @click="bewerkPrognose(d)"
        >
          <span class="label">{{ d.naam }}</span>
          <span class="datumknop-rij">
            <b class="n" :class="{ leeg: !d.waarde }">{{ d.waarde ? fmt(naarDatum(d.waarde)) : 'Kies datum' }}</b>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 1.7a1.6 1.6 0 0 1 2.3 0l.7.7a1.6 1.6 0 0 1 0 2.3l-8 8-3.4 1.1 1.1-3.4 8-8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>
          </span>
        </button>
      </div>
    </section>
    <ProcesDatumBewerken
      v-if="bewerken" :veld="bewerken.veld" :naam="bewerken.naam" :waarde="bewerken.waarde" :prognose="bewerken.prognose"
      @sluit="bewerken = null"
    />
  </div>
</template>

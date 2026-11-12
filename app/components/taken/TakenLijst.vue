<script setup lang="ts">
import { FASEN, faseInfo } from '~/lib/fasen'
import { groepenVoor, UITZONDERINGEN_GROEP } from '~/lib/taken'
import { opUrgentie, samen, telling, type TaakRegel } from '~/lib/stoplicht'
import { kolomSjabloon } from '~/lib/weergave'
import type { TaakWijziging } from '~/lib/types'
import { pastInFilter, type Filter } from '~/composables/useProjectkaart'

const kaart = useKaart()
const { project, regelsPerFase, weggehaald, tabFase, filter } = kaart
const { weergave } = useWeergave()

const regels = computed(() => regelsPerFase.value?.[tabFase.value] ?? [])

// De volgorde ligt vast zolang je in dezelfde fase en hetzelfde filter werkt:
// een taak springt niet weg terwijl je hem aanpast.
const volgorde = ref<string[]>([])
function herorden() {
  const urgent = ['open', 'telaat', 'letop'].includes(filter.value)
  volgorde.value = (urgent ? opUrgentie(regels.value) : regels.value).map(r => r.id)
}
watch([tabFase, filter], herorden, { immediate: true })
watch(() => regels.value.map(r => r.id).join('|'), () => {
  const bekend = new Set(volgorde.value)
  const nieuw = regels.value.filter(r => !bekend.has(r.id)).map(r => r.id)
  if (nieuw.length) volgorde.value = [...volgorde.value, ...nieuw]
})

// Een net gewijzigde taak blijft even staan (de stempel), en glijdt dan weg als hij niet meer in het filter past.
const vastgehouden = ref(new Set<string>())
function houdVast(id: string) {
  vastgehouden.value = new Set(vastgehouden.value).add(id)
  setTimeout(() => {
    const s = new Set(vastgehouden.value)
    s.delete(id)
    vastgehouden.value = s
  }, minderBeweging() ? 0 : 1000)
}

const zichtbaar = computed(() => {
  const per = new Map(regels.value.map(r => [r.id, r]))
  return volgorde.value.map(id => per.get(id))
    .filter((r): r is TaakRegel => !!r && (pastInFilter(r.b.licht, filter.value) || vastgehouden.value.has(r.id)))
})

const groepen = computed(() => [
  ...groepenVoor(tabFase.value, project.value?.aangemaakt_op).map(g => ({ titel: g.titel, uitleg: g.uitleg, uitzondering: false, sleutels: g.taken.map(t => t.sleutel) })),
  { titel: UITZONDERINGEN_GROEP, uitleg: undefined, uitzondering: true, sleutels: [] as string[] },
].map((g) => {
  const alle = regels.value.filter(r => r.groep === g.titel)
  const t = telling(alle)
  return { ...g, alle, rijen: zichtbaar.value.filter(r => r.groep === g.titel), klaar: t.klaar, totaal: alle.length - t.later }
}))
const leeg = computed(() => !zichtbaar.value.some(r => !r.uitzondering))

const fasetabs = computed(() => FASEN.map((f) => {
  const r = regelsPerFase.value?.[f.id] ?? []
  const t = telling(r)
  return { ...f, licht: samen(r.map(x => x.b.licht)), klaar: t.klaar, totaal: r.length - t.later }
}))

const FILTERS: { id: Filter, naam: string }[] = [{ id: 'open', naam: 'Open' }, { id: 'klaar', naam: 'Klaar' }, { id: 'alles', naam: 'Alles' }]
const UITLEG: Record<Filter, string> = {
  open: 'Wat nog moet gebeuren, het dringendste bovenaan.', klaar: 'Wat definitief is, met document.', alles: 'Alle taken van deze fase.',
  telaat: 'Alleen wat te laat is.', letop: 'Alleen wat aandacht vraagt.',
}
const leegTekst = computed(() => {
  const naam = faseInfo(tabFase.value).naam
  return ({ open: `Niets open in ${naam}. Alles is klaar of niet van toepassing.`, klaar: `Nog niets klaar in ${naam}.`, alles: '', telaat: `Niets te laat in ${naam}.`, letop: `Niets dat aandacht vraagt in ${naam}.` })[filter.value]
})

// De schuivende streep onder de fasetabs.
const tabKnoppen = ref<Record<string, HTMLElement>>({})
const streep = reactive({ x: 0, w: 0 })
function meet() {
  const b = tabKnoppen.value[tabFase.value]
  if (b) Object.assign(streep, { x: b.offsetLeft, w: b.offsetWidth })
}
watch(tabFase, () => nextTick(meet))
onMounted(() => {
  meet()
  document.fonts?.ready.then(meet)
  addEventListener('resize', meet)
})
onBeforeUnmount(() => removeEventListener('resize', meet))

async function wijzig(regel: TaakRegel, w: TaakWijziging) {
  houdVast(regel.id)
  await kaart.wijzigTaak(regel, w)
}

// ---------- weghalen bij dit project, en terugzetten ----------
// Een standaardtaak (of een hele groep) die hier niet nodig is, gaat van de kaart en telt nergens meer mee.
// Status, document en opmerkingen blijven bewaard: terugzetten brengt alles terug. Een uitzondering gaat echt weg.
function weghalen(regel: TaakRegel) {
  if (regel.standaard) return kaart.zetWeggehaald(regel.fase, [regel.standaard.sleutel], true, regel.titel)
  if (confirm(`Uitzondering "${regel.titel}" weghalen uit dit project? De status en de opmerkingen gaan verloren.`)) kaart.verwijderUitzondering(regel)
}
function groepWeghalen(g: { titel: string, alle: TaakRegel[] }) {
  const sleutels = g.alle.flatMap(r => r.standaard ? [r.standaard.sleutel] : [])
  if (sleutels.length > 1 && !confirm(`Alle ${sleutels.length} taken van "${g.titel}" weghalen bij dit project? Terugzetten kan onderaan de fase.`)) return
  kaart.zetWeggehaald(tabFase.value, sleutels, true, sleutels.length > 1 ? g.titel : g.alle[0]!.titel)
}

const weg = computed(() => weggehaald.value?.[tabFase.value] ?? [])
const wegGroepen = computed(() => {
  const per = new Map<string, typeof weg.value>()
  for (const w of weg.value) per.set(w.groep, [...(per.get(w.groep) ?? []), w])
  return [...per].map(([titel, taken]) => ({ titel, taken }))
})
const terugzetten = (sleutels: string[], naam: string) => kaart.zetWeggehaald(tabFase.value, sleutels, false, naam)
</script>

<template>
  <section
    v-if="project" id="taken" class="blok"
    :class="{ 'zonder-eigenaar': !weergave.taken.kolommen.eigenaar, 'zonder-deadline': !weergave.taken.kolommen.deadline, 'zonder-akkoord': !weergave.taken.kolommen.akkoord, 'zonder-document': !weergave.taken.kolommen.document, compact: weergave.taken.compact }"
    :style="{ '--kolommen': kolomSjabloon(weergave) }"
  >
    <div class="blokkop">
      <div>
        <h2>Taken per fase</h2>
        <p class="klein">Standaardtaken krijgt elk project. Is een taak of een hele groep hier niet nodig, haal hem dan weg met het kruisje; terugzetten kan onderaan de fase. Uitzonderingen voeg je per project toe uit de catalogus; wat vaak terugkomt, wordt een kandidaat voor het standaardpakket.</p>
      </div>
    </div>

    <div class="fasetabs" role="tablist" aria-label="Fase">
      <button
        v-for="f in fasetabs" :key="f.id" :ref="el => { if (el) tabKnoppen[f.id] = el as HTMLElement }"
        type="button" role="tab" :aria-selected="tabFase === f.id" @click="tabFase = f.id"
      >
        <i class="punt" :class="f.licht === 'open' ? '' : f.licht" />{{ f.naam }}<span class="telling n">{{ f.klaar }}/{{ f.totaal }}</span>
      </button>
      <span class="indicator" :style="{ width: `${streep.w}px`, transform: `translateX(${streep.x}px)` }" />
    </div>

    <div class="filters">
      <div class="seg" role="group" aria-label="Filter">
        <button v-for="f in FILTERS" :key="f.id" type="button" :aria-pressed="filter === f.id" @click="filter = f.id">{{ f.naam }}</button>
      </div>
      <span class="klein">{{ UITLEG[filter] }}</span>
    </div>

    <div v-if="leeg && leegTekst" class="leeg-staat">{{ leegTekst }}</div>

    <template v-for="(g, gi) in groepen" :key="`${tabFase}-${g.titel}`">
      <div v-if="g.rijen.length || g.uitzondering" class="groep">
        <div class="groep-kop">
          <h3>{{ g.titel }}<span v-if="g.uitleg" class="klein"> · {{ g.uitleg }}</span></h3>
          <span class="klein n groep-rechts">
            {{ g.uitzondering && !g.totaal ? 'geen' : `${g.klaar} van ${g.totaal} klaar` }}
            <span v-if="g.totaal" class="voortgang"><i :style="{ width: `${Math.round(g.klaar / g.totaal * 100)}%` }" /></span>
            <button
              v-if="!g.uitzondering && g.alle.length" type="button" class="taak-weg groep-weg" title="Deze groep is niet nodig in dit project: weghalen (terug te zetten)"
              :aria-label="`Groep ${g.titel} weghalen bij dit project`" @click="groepWeghalen(g)"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
            </button>
          </span>
        </div>
        <div class="lijst">
          <div v-if="gi === 0 || !groepen.slice(0, gi).some(x => x.rijen.length)" class="kolkop">
            <span>Stand</span><span>Taak</span><span data-kol="eigenaar">Eigenaar</span><span data-kol="deadline">Deadline</span>
            <span data-kol="akkoord">Akkoord</span><span data-kol="document">Document</span><span>Status</span><span />
          </div>
          <TransitionGroup name="rij" tag="div" class="lijst-in">
            <TakenRij v-for="(r, i) in g.rijen" :key="r.id" :regel="r" :style="{ '--i': i }" @wijzig="w => wijzig(r, w)" @verwijder="weghalen(r)" />
          </TransitionGroup>
          <TakenUitzondering v-if="g.uitzondering" />
        </div>
      </div>
    </template>

    <details v-if="weg.length" class="weggehaald">
      <summary class="klein">Weggehaald bij dit project: {{ weg.length }} {{ weg.length === 1 ? 'taak' : 'taken' }}</summary>
      <p class="klein">Niet nodig in dit project, dus niet op de kaart en niet in het stoplicht. Wat er al was ingevuld, komt bij terugzetten terug.</p>
      <div v-for="wg in wegGroepen" :key="wg.titel" class="weg-groep">
        <div class="weg-kop">
          <h3>{{ wg.titel }}</h3>
          <button v-if="wg.taken.length > 1" type="button" class="link" @click="terugzetten(wg.taken.map(w => w.standaard.sleutel), wg.titel)">Alles terugzetten</button>
        </div>
        <ul>
          <li v-for="w in wg.taken" :key="w.id">
            <span>{{ w.standaard.titel }}</span>
            <button type="button" class="link" :aria-label="`${w.standaard.titel} terugzetten`" @click="terugzetten([w.standaard.sleutel], w.standaard.titel)">Terugzetten</button>
          </li>
        </ul>
      </div>
    </details>
  </section>
</template>

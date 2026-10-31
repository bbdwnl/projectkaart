<script setup lang="ts">
import type { Actie, Controlepunt, Licht, Project, Taak, Uitzondering } from '~/lib/types'
import { ROLLEN } from '~/lib/fasen'
import { meeting, pastBij, VOORUIT_DAGEN, type MeetingRij } from '~/lib/maandmeeting'
import { dagen, fmt, vandaag } from '~/lib/datum'

// De maandelijkse meeting: de fase-eigenaren bekijken met de bedrijfsleider welke werken afwijken. Per fase wat
// afwijkt, het ernstigste eerst en in woorden waarom; wat op schema ligt staat erachter. Onderaan de mijlpalen tot de
// volgende meeting. Af te drukken voor op tafel.
useHead({ title: 'Maand meeting · Projectkaart' })
const bron = useBron()
const nu = vandaag()
const stand = ref<'laden' | 'klaar' | 'fout'>('laden')
const fout = ref('')
const projecten = ref<Project[]>([])
const taken = ref<Taak[]>([])
const catalogus = ref<Uitzondering[]>([])
const acties = ref<Actie[]>([])
const punten = ref<Controlepunt[]>([])
const route = useRoute()
const router = useRouter()
const wie = computed({
  get: () => (typeof route.query.wie === 'string' && route.query.wie ? route.query.wie : 'alle'),
  set: (w: string) => {
    const { wie: _, ...rest } = route.query
    router.replace({ query: w === 'alle' ? rest : { ...rest, wie: w } })
  },
})
const toonOpSchema = ref(false)

async function laad(stil = false) {
  if (!stil) stand.value = 'laden'
  try {
    ;[projecten.value, taken.value, catalogus.value, acties.value, punten.value] = await Promise.all([
      bron.projecten(), bron.taken(), bron.uitzonderingen(), bron.acties(), bron.controlepunten(),
    ])
    stand.value = 'klaar'
  } catch (e) {
    if (stil) return
    fout.value = foutTekst(e)
    stand.value = 'fout'
  }
}
onMounted(() => laad())
useLive(() => [{ tabel: 'projecten' }, { tabel: 'taken' }, { tabel: 'acties' }, { tabel: 'controlepunten' }], () => laad(true))

const m = computed(() => meeting(projecten.value, taken.value, catalogus.value, acties.value, punten.value, nu))
const alleRijen = computed(() => m.value.fasen.flatMap(f => [...f.afwijkend, ...f.opSchema]))
/** De mensen om op te filteren, met hoeveel projecten van hen afwijken; "zonder" achteraan. */
const mensen = computed(() => {
  const namen = new Set(alleRijen.value.map(r => r.wie ?? 'geen'))
  if (wie.value !== 'alle') namen.add(wie.value)
  return [...namen].sort((a, b) => Number(a === 'geen') - Number(b === 'geen') || a.localeCompare(b, 'nl'))
    .map(id => ({ id, aantal: m.value.fasen.flatMap(f => f.afwijkend).filter(r => (r.wie ?? 'geen') === id).length }))
})
const fasen = computed(() => m.value.fasen.map(f => ({
  ...f, afwijkend: f.afwijkend.filter(r => pastBij(r, wie.value)), opSchema: f.opSchema.filter(r => pastBij(r, wie.value)),
})).filter(f => f.afwijkend.length || f.opSchema.length))
const afwijkend = computed(() => fasen.value.reduce((n, f) => n + f.afwijkend.length, 0))
const totaal = computed(() => fasen.value.reduce((n, f) => n + f.afwijkend.length + f.opSchema.length, 0))
const mijlpalen = computed(() => m.value.mijlpalen.filter(x => wie.value === 'alle'
  || alleRijen.value.some(r => r.p.id === x.p.id && pastBij(r, wie.value))))
const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
const WOORD: Record<Licht, string> = { telaat: 'Te laat', letop: 'Let op', open: 'Open', klaar: 'Op schema', later: 'Later' }
const wieTekst = (r: MeetingRij) => `${ROLLEN[r.rol].kort} ${r.wie ?? 'nog niet gekozen'}`
const wanneer = (n: number) => (n === 0 ? 'vandaag' : n === 1 ? 'morgen' : `over ${dagen(n)}`)
const afdrukken = () => window.print()
</script>

<template>
  <main class="wrap meeting">
    <header class="paginakop kop-met-knop">
      <div>
        <h1 class="verborgen">Maand meeting</h1>
        <p v-if="stand === 'klaar'" class="zin">
          {{ MAAND[nu.getMonth()] }} {{ nu.getFullYear() }} · {{ afwijkend ? `${afwijkend} van ${totaal} projecten wijken af.` : `Alle ${totaal} projecten liggen op schema.` }}
        </p>
      </div>
      <div class="kop-knoppen">
        <button type="button" class="knop" @click="afdrukken">Afdrukken</button>
      </div>
    </header>

    <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /><span class="laden-regel" /></div>
    <div v-else-if="stand === 'fout'" class="leeg-staat">{{ fout }} <button type="button" class="link" @click="laad()">Probeer het opnieuw</button></div>
    <template v-else>
      <div class="filters meeting-filters">
        <div class="filtergroep">
          <span class="label">Fase-eigenaar</span>
          <div class="seg" role="group" aria-label="Fase-eigenaar">
            <button type="button" :aria-pressed="wie === 'alle'" @click="wie = 'alle'">Iedereen</button>
            <button v-for="p in mensen" :key="p.id" type="button" :aria-pressed="wie === p.id" :title="`${p.aantal} wijken af`" @click="wie = p.id">{{ p.id === 'geen' ? 'Zonder' : p.id }} <span class="n">{{ p.aantal }}</span></button>
          </div>
        </div>
        <label class="schakel"><input v-model="toonOpSchema" type="checkbox"><span />Toon wat op schema ligt <small class="n">{{ totaal - afwijkend }}</small></label>
      </div>

      <section v-for="f in fasen" :key="f.fase" class="blok meeting-fase" :aria-labelledby="`meeting-${f.fase}`">
        <header class="kolom-kop">
          <h2 :id="`meeting-${f.fase}`">{{ f.naam }}</h2>
          <span class="klein n">{{ f.afwijkend.length }} van {{ f.afwijkend.length + f.opSchema.length }} wijken af · {{ ROLLEN[f.rol].kort }}</span>
        </header>
        <ol v-if="f.afwijkend.length" class="meeting-lijst">
          <li v-for="r in f.afwijkend" :key="r.p.id" class="kaart meeting-rij">
            <div class="meeting-kop">
              <StatusTab :licht="r.licht" :woord="WOORD[r.licht]" />
              <NuxtLink :to="`/projecten/${r.p.slug}`" class="meeting-naam"><span v-if="r.p.nummer" class="label n">{{ r.p.nummer }}</span>{{ r.p.naam }}</NuxtLink>
              <span class="chip wie" :class="{ leeg: !r.wie }" :title="ROLLEN[r.rol].naam">{{ wieTekst(r) }}</span>
            </div>
            <ul class="meeting-waarom">
              <li v-for="(a, i) in r.afwijkingen" :key="i" :class="a.licht"><i aria-hidden="true" />{{ a.tekst }}</li>
            </ul>
          </li>
        </ol>
        <p v-else class="leeg-staat klein">Niets wijkt af in {{ f.naam.toLowerCase() }}.</p>
        <p v-if="toonOpSchema && f.opSchema.length" class="meeting-opschema klein">
          <b>Op schema:</b>
          <template v-for="(r, i) in f.opSchema" :key="r.p.id"><NuxtLink :to="`/projecten/${r.p.slug}`">{{ r.p.naam }}</NuxtLink><span v-if="i < f.opSchema.length - 1"> · </span></template>
        </p>
      </section>
      <p v-if="!fasen.length" class="leeg-staat">Geen projecten bij deze keuze.</p>

      <section class="blok meeting-fase" aria-labelledby="meeting-mijlpalen">
        <header class="kolom-kop">
          <h2 id="meeting-mijlpalen">Tot de volgende meeting</h2>
          <span class="klein n">mijlpalen in de komende {{ VOORUIT_DAGEN / 7 }} weken</span>
        </header>
        <ol v-if="mijlpalen.length" class="meeting-mijlpalen">
          <li v-for="x in mijlpalen" :key="`${x.p.id}-${x.naam}`">
            <span class="n">{{ fmt(x.datum) }}</span>
            <NuxtLink :to="`/projecten/${x.p.slug}`">{{ x.p.naam }}</NuxtLink>
            <span>{{ x.naam }}</span>
            <span class="klein">{{ wanneer(x.dagen) }}</span>
          </li>
        </ol>
        <p v-else class="leeg-staat klein">Geen mijlpalen in de komende {{ VOORUIT_DAGEN / 7 }} weken.</p>
      </section>
    </template>
    <footer>Projectkaart BbDW · Maand meeting van {{ fmt(nu) }}</footer>
  </main>
</template>

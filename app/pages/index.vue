<script setup lang="ts">
import type { Fase, Licht, Project, Taak, Uitzondering } from '~/lib/types'
import { FASEN, faseInfo } from '~/lib/fasen'
import { ORDE, samen, takenVan, telling, volgendeMijlpaal } from '~/lib/stoplicht'
import { dagen, vandaag } from '~/lib/datum'

// Tijdelijk overzicht om naar een projectkaart te gaan. Het echte overzicht volgt in fase C.
useHead({ title: 'Projecten · Projectkaart' })
const bron = useBron()
const { modus } = useGebruiker()
const nu = vandaag()
const stand = ref<'laden' | 'klaar' | 'fout'>('laden')
const fout = ref('')
const projecten = ref<Project[]>([])
const taken = ref<Taak[]>([])
const catalogus = ref<Uitzondering[]>([])
const fase = ref<Fase | 'alle'>('alle')
const zoek = ref('')

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

const WOORD: Record<Licht, string> = { telaat: 'Te laat', letop: 'Let op', open: 'Op schema', klaar: 'Klaar', later: 'Geen taken' }
// Leads hebben hun eigen lijst (/leads); hier staan de projecten vanaf haalbaarheid.
const lopend = computed(() => projecten.value.filter(p => p.fase !== 'lead'))
const kaartjes = computed(() => lopend.value.map((p) => {
  const regels = takenVan(p.fase, p, taken.value.filter(t => t.project_id === p.id), catalogus.value, nu)
  return { p, t: telling(regels), licht: samen(regels.map(r => r.b.licht)), mijlpaal: volgendeMijlpaal(p, nu) }
}).sort((a, b) => ORDE[a.licht] - ORDE[b.licht] || b.t.telaat - a.t.telaat || (a.mijlpaal?.dagen ?? 1e6) - (b.mijlpaal?.dagen ?? 1e6)))

const zichtbaar = computed(() => {
  const z = zoek.value.trim().toLowerCase()
  return kaartjes.value.filter(k => (fase.value === 'alle' || k.p.fase === fase.value)
    && (!z || [k.p.naam, k.p.nummer, k.p.afas_nummer, k.p.plaats].filter(Boolean).join(' ').toLowerCase().includes(z)))
})
// Elke fase vanaf haalbaarheid als filter, ook als er nu geen project in staat (zoals nazorg).
const perFase = computed(() => FASEN.filter(f => f.id !== 'lead').map(f => ({ ...f, aantal: lopend.value.filter(p => p.fase === f.id).length })))
const leegTekst = computed(() => zoek.value.trim()
  ? 'Geen project gevonden. Zoek op een deel van de naam of het nummer.'
  : fase.value === 'alle' ? 'Nog geen lopende projecten.' : `Geen projecten in de fase ${faseInfo(fase.value).naam.toLowerCase()}.`)
const zin = computed(() => {
  const laat = kaartjes.value.filter(k => k.t.telaat).length
  return `${kaartjes.value.length} lopende projecten. ${laat ? `${laat} ${laat === 1 ? 'heeft' : 'hebben'} taken die te laat zijn.` : 'Niets te laat.'}`
})
const mijlpaalTekst = (m: ReturnType<typeof volgendeMijlpaal>) => !m ? 'Geen mijlpaal' : m.dagen >= 0 ? `Nog ${dagen(m.dagen)} tot ${m.naam}` : `${m.naam[0]!.toUpperCase()}${m.naam.slice(1)} was ${dagen(-m.dagen)} geleden`
</script>

<template>
  <main class="wrap">
    <p v-if="modus === 'proef'" class="melding">Proefversie. De projecten en datums komen uit het prototype; statussen, mensen en documenten zijn voorbeeldgegevens. Je wijzigingen blijven alleen in deze browser.</p>
    <header class="paginakop">
      <p class="label">Alle lopende projecten</p>
      <h1>Projecten</h1>
      <p v-if="stand === 'klaar'" class="zin">{{ zin }}</p>
    </header>

    <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /><span class="laden-regel" /></div>
    <div v-else-if="stand === 'fout'" class="leeg-staat">{{ fout }} <button type="button" class="link" @click="laad">Probeer het opnieuw</button></div>
    <template v-else>
      <div class="filters projectfilters">
        <div class="seg" role="group" aria-label="Fase">
          <button type="button" :aria-pressed="fase === 'alle'" @click="fase = 'alle'">Alle <span class="n">{{ lopend.length }}</span></button>
          <button v-for="f in perFase" :key="f.id" type="button" :aria-pressed="fase === f.id" @click="fase = f.id">{{ f.naam }} <span class="n">{{ f.aantal }}</span></button>
        </div>
        <input v-model="zoek" class="veld zoekveld" type="search" placeholder="Zoek op naam, projectnummer of AFAS-nummer" aria-label="Zoek een project">
      </div>
      <div class="projectgrid">
        <NuxtLink v-for="(k, i) in zichtbaar" :key="k.p.id" :to="`/projecten/${k.p.slug}`" class="kaart til projectkaartje" :style="{ '--i': Math.min(i, 12) }">
          <StatusTab :licht="k.licht" :woord="WOORD[k.licht]" />
          <span class="label">{{ [k.p.nummer, k.p.plaats].filter(Boolean).join(' · ') }}<template v-if="k.p.prio"> · prio</template></span>
          <h3>{{ k.p.naam }}</h3>
          <p class="fase-regel">{{ faseInfo(k.p.fase).naam }}</p>
          <span class="mini-balk" aria-hidden="true">
            <span class="seg-telaat" :style="{ flexGrow: k.t.telaat }" /><span class="seg-letop" :style="{ flexGrow: k.t.letop }" />
            <span class="seg-klaar" :style="{ flexGrow: k.t.klaar }" /><span class="seg-open" :style="{ flexGrow: k.t.open }" />
          </span>
          <p class="klein">{{ k.t.telaat }} te laat · {{ k.t.letop }} let op · {{ k.t.klaar }} klaar</p>
          <p class="mijlpaal">{{ mijlpaalTekst(k.mijlpaal) }}</p>
        </NuxtLink>
      </div>
      <p v-if="!zichtbaar.length" class="leeg-staat">{{ leegTekst }}</p>
    </template>
    <footer>Projectkaart BbDW · het volledige overzicht met planning, kaart en financieel komt in de volgende fase.</footer>
  </main>
</template>

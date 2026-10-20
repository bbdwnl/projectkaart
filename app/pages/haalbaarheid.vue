<script setup lang="ts">
import type { Project, Taak, Uitzondering } from '~/lib/types'
import { leadsVan } from '~/lib/leads'
import { vandaag } from '~/lib/datum'

// De projecten in haalbaarheid: na de lead, voor de ontwikkeling. Dezelfde lijst als bij Leads, en een
// planningsoverzicht waarin de prognose over de lopende projecten heen valt, zodat je de overlap ziet.
useHead({ title: 'Haalbaarheid · Projectkaart' })
const bron = useBron()
const { modus } = useGebruiker()
const nu = vandaag()
const stand = ref<'laden' | 'klaar' | 'fout'>('laden')
const fout = ref('')
const projecten = ref<Project[]>([])
const taken = ref<Taak[]>([])
const catalogus = ref<Uitzondering[]>([])
const TABS = [{ id: 'lijst', naam: 'Lijst' }, { id: 'planning', naam: 'Planningsoverzicht' }] as const
const weergave = useTabblad<'lijst' | 'planning'>('lijst', ['lijst', 'planning'])

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

const regels = computed(() => leadsVan(projecten.value, taken.value, catalogus.value, nu, 'haalbaarheid'))
const zin = computed(() => {
  const n = regels.value.length
  if (!n) return 'Geen projecten in haalbaarheid.'
  const zonder = regels.value.filter(l => !l.p.prognose_casco && !l.p.prognose_afbouw && !l.p.prognose_oplevering).length
  const klaar = regels.value.filter(l => l.licht === 'klaar').length
  return `${n} ${n === 1 ? 'project' : 'projecten'} in haalbaarheid${zonder ? `, ${zonder} nog zonder prognose` : ''}. ${klaar ? `${klaar} ${klaar === 1 ? 'is' : 'zijn'} klaar voor de overdracht.` : 'Nog geen enkele is klaar voor de overdracht.'}`
})
</script>

<template>
  <main class="wrap">
    <p v-if="modus === 'proef'" class="melding">Proefversie. De projecten en datums komen uit het prototype; statussen, mensen, prognoses en documenten zijn voorbeeldgegevens. Je wijzigingen blijven alleen in deze browser.</p>
    <header class="paginakop">
      <p class="label">Na de lead, voor de ontwikkeling</p>
      <h1>Haalbaarheid</h1>
      <p v-if="stand === 'klaar'" class="zin">{{ zin }}</p>
    </header>

    <PaginaTabs v-model="weergave" :tabs="[...TABS]" label="Weergave van haalbaarheid" />
    <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /><span class="laden-regel" /></div>
    <div v-else-if="stand === 'fout'" class="leeg-staat">{{ fout }} <button type="button" class="link" @click="laad">Probeer het opnieuw</button></div>
    <template v-else-if="weergave === 'lijst'">
      <ProjectLijst v-if="regels.length" fase="haalbaarheid" :regels="regels" />
      <p v-else class="leeg-staat leadfilters">Nog geen projecten in haalbaarheid. Een lead komt hier zodra je op de kaart de fase op Haalbaarheid zet.</p>
    </template>
    <PlanningOverzicht v-else :projecten="projecten" :lagen="['prognose', 'lopend']" />
    <footer>Projectkaart BbDW · de prognose vul je op de kaart in onder Proces &amp; Planning. Een project gaat naar Projecten zodra je de fase op Ontwikkeling zet.</footer>
  </main>
</template>

<script setup lang="ts">
import { TABS, type Tab } from '~/lib/weergave'
import { dagen } from '~/lib/datum'

const route = useRoute()
const kaart = useProjectkaart(String(route.params.slug))
const { project, stand, fout, lichten, mijlpaal, tabFase, filter } = kaart
const { weergave } = useWeergave()
const { modus } = useGebruiker()

// Een link met #taken, #proces of #details opent dat tabblad; anders het laatst gebruikte.
const uitLink = route.hash.slice(1) as Tab
if (TABS.includes(uitLink)) weergave.value.tab = uitLink
const richting = ref(1)
watch(() => weergave.value.tab, (nieuw, oud) => {
  richting.value = TABS.indexOf(nieuw) >= TABS.indexOf(oud) ? 1 : -1
  // Alleen de adresbalk bijwerken (deelbare link), zonder navigatie of scrollen.
  history.replaceState(history.state, '', `#${nieuw}`)
})

const kruimel = useState<string | null>('kruimel', () => null)
watch(() => project.value?.naam, n => (kruimel.value = n ?? null), { immediate: true })
onBeforeUnmount(() => (kruimel.value = null))
useHead({ title: () => project.value ? `${project.value.naam} · Projectkaart` : 'Projectkaart · BbDW' })

kaart.laad()

const pilTaken = computed(() => {
  const n = lichten.value.telaat + lichten.value.letop
  return { licht: lichten.value.telaat ? 'telaat' as const : lichten.value.letop ? 'letop' as const : 'klaar' as const, tekst: n ? `${n} ${n === 1 ? 'vraagt' : 'vragen'} aandacht` : 'Op schema' }
})
const pilProces = computed(() => {
  const m = mijlpaal.value
  return m ? (m.dagen >= 0 ? dagen(m.dagen) : `${dagen(-m.dagen)} geleden`) : null
})

function naarTabs() {
  document.getElementById('tabanker')?.scrollIntoView({ behavior: minderBeweging() ? 'auto' : 'smooth', block: 'start' })
}
function lamp(licht: 'telaat' | 'letop' | 'klaar') {
  weergave.value.tab = 'taken'
  tabFase.value = project.value!.fase
  filter.value = licht
  nextTick(naarTabs)
}
function planning() {
  weergave.value.tab = 'proces'
  nextTick(naarTabs)
}
</script>

<template>
  <main class="wrap">
    <p v-if="modus === 'proef'" class="melding">Proefversie. Naam, projectnummer en datums komen uit het prototype; statussen, mensen, documenten en bedragen zijn voorbeeldgegevens. Je wijzigingen blijven alleen in deze browser.</p>

    <div v-if="stand === 'laden'" class="laden" aria-busy="true">
      <span class="laden-regel kort" /><span class="laden-regel titel" /><span class="laden-regel" /><span class="laden-regel" />
    </div>

    <section v-else-if="stand === 'niet-gevonden'" class="blok">
      <h1>Dit project bestaat niet.</h1>
      <p class="lead">Misschien is de link oud, of is het project hernoemd.</p>
      <NuxtLink class="knop zwart" to="/">Naar de projecten</NuxtLink>
    </section>

    <section v-else-if="stand === 'fout'" class="blok">
      <h1>De kaart kon niet laden.</h1>
      <p class="lead">{{ fout }}</p>
      <button type="button" class="knop zwart" @click="kaart.laad()">Probeer het opnieuw</button>
    </section>

    <template v-else-if="project">
      <KaartKop @lamp="lamp" @planning="planning" />
      <div id="tabanker" />
      <KaartTabs v-model="weergave.tab" :pil-taken="pilTaken" :pil-proces="pilProces" />
      <Transition :name="richting > 0 ? 'paneel-vooruit' : 'paneel-terug'" mode="out-in">
        <KaartTaken v-if="weergave.tab === 'taken'" key="taken" />
        <KaartProces v-else-if="weergave.tab === 'proces'" key="proces" />
        <KaartDetails v-else key="details" />
      </Transition>
    </template>

    <footer>Projectkaart BbDW</footer>
  </main>
</template>

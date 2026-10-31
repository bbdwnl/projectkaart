<script setup lang="ts">
import { TABS, type Tab } from '~/lib/weergave'

const route = useRoute()
const kaart = useProjectkaart(String(route.params.slug))
const { project, stand, fout, lichten, tabFase, filter, openPunten, openActies, nu } = kaart
const { weergave } = useWeergave()

// Een link met #taken, #proces, #acties, #controle of #details opent dat tabblad; anders het laatst gebruikte.
const uitLink = route.hash.slice(1) as Tab
if (TABS.includes(uitLink)) weergave.value.tab = uitLink
const richting = ref(1)
watch(() => weergave.value.tab, (nieuw, oud) => {
  richting.value = TABS.indexOf(nieuw) >= TABS.indexOf(oud) ? 1 : -1
  // Alleen de adresbalk bijwerken (deelbare link), zonder navigatie of scrollen.
  history.replaceState(history.state, '', `#${nieuw}`)
})

// In het menu staat de naam achter het menu-item van zijn fase: Acquisitie (leads) of Projecten.
const kruimel = useState<{ naam: string, groep: 'leads' | 'projecten' } | null>('kruimel', () => null)
watch(() => project.value && `${project.value.fase}:${project.value.naam}`, () => {
  kruimel.value = project.value ? { naam: project.value.naam, groep: project.value.fase === 'lead' ? 'leads' : 'projecten' } : null
}, { immediate: true })
onBeforeUnmount(() => (kruimel.value = null))
useHead({ title: () => project.value ? `${project.value.naam} · Projectkaart` : 'Projectkaart · BbDW' })

kaart.laad()

const pilTaken = computed(() => {
  const n = lichten.value.telaat + lichten.value.letop
  return { licht: lichten.value.telaat ? 'telaat' as const : lichten.value.letop ? 'letop' as const : 'klaar' as const, tekst: n ? `${n} ${n === 1 ? 'vraagt' : 'vragen'} aandacht` : 'Op schema' }
})

const pilActies = computed(() => {
  const n = openActies.value.length
  if (!n) return null
  const laat = openActies.value.filter(a => a.deadline && new Date(a.deadline) < nu).length
  return { licht: laat ? 'telaat' as const : 'open' as const, tekst: laat ? `${laat} te laat` : `${n} open` }
})
const pilControle = computed(() => openPunten.value ? `${openPunten.value} open` : null)

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
      <KaartTabs v-model="weergave.tab" :pil-taken="pilTaken" :pil-acties="pilActies" :pil-controle="pilControle" />
      <Transition :name="richting > 0 ? 'paneel-vooruit' : 'paneel-terug'" mode="out-in">
        <KaartTaken v-if="weergave.tab === 'taken'" key="taken" />
        <KaartProces v-else-if="weergave.tab === 'proces'" key="proces" />
        <KaartActies v-else-if="weergave.tab === 'acties'" key="acties" />
        <KaartControle v-else-if="weergave.tab === 'controle'" key="controle" />
        <KaartDetails v-else key="details" />
      </Transition>
    </template>

    <footer>Projectkaart BbDW</footer>
  </main>
</template>

<script setup lang="ts">
import { TABS, type Tab } from '~/lib/weergave'
import type { Licht } from '~/lib/types'

const tab = defineModel<Tab>({ required: true })
defineProps<{ pilTaken: { licht: Licht, tekst: string }, pilProces: string | null, pilControle: string | null }>()

const NAMEN: Record<Tab, string> = { taken: 'Taken', proces: 'Proces & Planning', controle: 'Controle', details: 'Details' }
const knoppen = ref<Partial<Record<Tab, HTMLElement>>>({})
const indicator = reactive({ x: 0, w: 0 })
/** De eerste keer staat het balkje meteen goed; daarna schuift het mee. */
const eerste = ref(true)
const weergaveOpen = ref(false)

function meet() {
  const b = knoppen.value[tab.value]
  if (!b?.offsetWidth) return
  Object.assign(indicator, { x: b.offsetLeft, w: b.offsetWidth })
  if (eerste.value) requestAnimationFrame(() => (eerste.value = false))
}
watch(tab, () => nextTick(meet))
// Opnieuw meten zodra een tab echt een maat heeft of van maat verandert: na een paginawissel
// (dan is een knop bij het opbouwen nog 0 breed), als de letter geladen is, of bij een ander label ("2 open").
let waarnemer: ResizeObserver | undefined
onMounted(() => {
  meet()
  waarnemer = new ResizeObserver(() => meet())
  for (const b of Object.values(knoppen.value)) if (b) waarnemer.observe(b)
})
onBeforeUnmount(() => waarnemer?.disconnect())

function toets(e: KeyboardEvent) {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
  e.preventDefault()
  const i = TABS.indexOf(tab.value)
  const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
  tab.value = TABS[j]!
  nextTick(() => knoppen.value[TABS[j]!]?.focus())
}
</script>

<template>
  <div class="tabbalk">
    <div class="tabrij" role="tablist" aria-label="Onderdelen van de projectkaart" @keydown="toets">
      <button
        v-for="t in TABS" :id="`tab-${t}`" :key="t" :ref="el => { if (el) knoppen[t] = el as HTMLElement }"
        type="button" role="tab" :aria-selected="tab === t" :aria-controls="`paneel-${t}`" :tabindex="tab === t ? 0 : -1"
        @click="tab = t"
      >
        {{ NAMEN[t] }}
        <span v-if="t === 'taken'" class="tab" :class="pilTaken.licht">{{ pilTaken.tekst }}</span>
        <span v-else-if="t === 'proces' && pilProces" class="tab nu">{{ pilProces }}</span>
        <span v-else-if="t === 'controle' && pilControle" class="tab letop">{{ pilControle }}</span>
      </button>
      <span class="tab-indicator" :class="{ direct: eerste }" :style="{ width: `${indicator.w}px`, transform: `translateX(${indicator.x}px)` }" />
    </div>
    <button type="button" class="knop klein weergave-knop" :aria-expanded="weergaveOpen" aria-controls="weergave" @click.stop="weergaveOpen = !weergaveOpen">Weergave aanpassen</button>
    <Transition name="pop">
      <KaartWeergave v-if="weergaveOpen" id="weergave" @sluit="weergaveOpen = false" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { TABS, type Tab } from '~/lib/weergave'
import type { Licht } from '~/lib/types'

const tab = defineModel<Tab>({ required: true })
const props = defineProps<{ pilTaken: { licht: Licht, tekst: string }, pilProces: string | null, pilControle: string | null }>()

const NAMEN: Record<Tab, string> = { taken: 'Taken', proces: 'Proces & Planning', controle: 'Controle', details: 'Details' }
const knoppen = ref<Partial<Record<Tab, HTMLElement>>>({})
const indicator = reactive({ x: 0, w: 0 })
const weergaveOpen = ref(false)

function meet() {
  const b = knoppen.value[tab.value]
  if (b) Object.assign(indicator, { x: b.offsetLeft, w: b.offsetWidth })
}
watch(tab, () => nextTick(meet))
// Een tab wordt breder of smaller als zijn label verandert ("2 open").
watch(() => [props.pilTaken.tekst, props.pilProces, props.pilControle], () => nextTick(meet))
onMounted(() => {
  meet()
  document.fonts?.ready.then(meet)
  addEventListener('resize', meet)
})
onBeforeUnmount(() => removeEventListener('resize', meet))

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
      <span class="tab-indicator" :style="{ width: `${indicator.w}px`, transform: `translateX(${indicator.x}px)` }" />
    </div>
    <button type="button" class="knop klein" :aria-expanded="weergaveOpen" aria-controls="weergave" @click.stop="weergaveOpen = !weergaveOpen">Weergave aanpassen</button>
    <Transition name="pop">
      <KaartWeergave v-if="weergaveOpen" id="weergave" @sluit="weergaveOpen = false" />
    </Transition>
  </div>
</template>

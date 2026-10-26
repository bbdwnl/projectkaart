<script setup lang="ts" generic="T extends string">
import type { Licht } from '~/lib/types'

// Tabbladen op een overzicht, zoals Lijst, Planningsoverzicht en Aandachtspunten. Een tab kan een pil met een getal
// hebben, zoals op de kaart. Pijltjestoetsen wisselen.
const tab = defineModel<T>({ required: true })
const props = defineProps<{ tabs: { id: T, naam: string, pil?: { licht: Licht, tekst: string } | null }[], label: string }>()
const knoppen = ref<HTMLElement[]>([])

function toets(e: KeyboardEvent) {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
  e.preventDefault()
  const i = props.tabs.findIndex(t => t.id === tab.value)
  const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + props.tabs.length) % props.tabs.length
  tab.value = props.tabs[j]!.id
  nextTick(() => knoppen.value[j]?.focus())
}
</script>

<template>
  <div class="paginatabs" role="tablist" :aria-label="label" @keydown="toets">
    <button
      v-for="t in tabs" :key="t.id" ref="knoppen" type="button" role="tab"
      :aria-selected="tab === t.id" :tabindex="tab === t.id ? 0 : -1" @click="tab = t.id"
    >
      {{ t.naam }}
      <span v-if="t.pil" class="tab" :class="t.pil.licht">{{ t.pil.tekst }}</span>
    </button>
  </div>
</template>

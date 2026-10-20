<script setup lang="ts">
import { DATUMVELDEN, PROGNOSEVELDEN } from '~/lib/fasen'
import type { ProjectDatums, ProjectPrognose } from '~/lib/types'

// De vijf harde datums. Pas er een aan en alle deadlines rekenen mee.
// Tijdens lead en haalbaarheid daarnaast de prognose: alleen voor het planningsoverzicht, niet voor de deadlines.
const { project, wijzigProject } = useKaart()
const flits = ref<string | null>(null)
const metPrognose = computed(() => !!project.value && (
  project.value.fase === 'lead' || project.value.fase === 'haalbaarheid' || PROGNOSEVELDEN.some(d => project.value![d.veld])))

async function zet(veld: keyof ProjectDatums | keyof ProjectPrognose, e: Event) {
  const waarde = (e.target as HTMLInputElement).value || null
  flits.value = null
  await nextTick()
  flits.value = veld
  wijzigProject({ [veld]: waarde }, veld.startsWith('prognose') ? 'Prognose aangepast · in het planningsoverzicht' : 'Datum aangepast · deadlines rekenen mee')
}
</script>

<template>
  <div v-if="project">
    <div v-if="metPrognose" class="prognose">
      <p class="label">Prognose</p>
      <p class="klein">Wanneer de bouw naar verwachting start en klaar is. Staat in het planningsoverzicht van Haalbaarheid, naast de lopende projecten.</p>
      <div class="datums drie">
        <label v-for="d in PROGNOSEVELDEN" :key="d.veld" class="datum" :class="{ leeg: !project[d.veld], flits: flits === d.veld }">
          <span class="label">{{ d.naam }}</span>
          <input type="date" :value="project[d.veld] ?? ''" :aria-label="`Prognose ${d.naam.toLowerCase()}`" @change="e => zet(d.veld, e)">
        </label>
      </div>
      <p class="label harde-kop">Harde datums</p>
    </div>
    <div class="datums">
      <label v-for="d in DATUMVELDEN" :key="d.veld" class="datum" :class="{ leeg: !project[d.veld], flits: flits === d.veld }">
        <span class="label">{{ d.naam }}</span>
        <input type="date" :value="project[d.veld] ?? ''" :aria-label="d.naam" @change="e => zet(d.veld, e)">
      </label>
    </div>
  </div>
</template>

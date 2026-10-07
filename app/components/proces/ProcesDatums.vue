<script setup lang="ts">
import { DATUMVELDEN } from '~/lib/fasen'
import type { ProjectDatums } from '~/lib/types'

// De vijf harde datums. Pas er een aan en alle deadlines rekenen mee.
const { project, wijzigProject } = useKaart()
const flits = ref<string | null>(null)

async function zet(veld: keyof ProjectDatums, e: Event) {
  const waarde = (e.target as HTMLInputElement).value || null
  flits.value = null
  await nextTick()
  flits.value = veld
  wijzigProject({ [veld]: waarde }, 'Datum aangepast · deadlines rekenen mee')
}
</script>

<template>
  <div v-if="project" class="datums">
    <label v-for="d in DATUMVELDEN" :key="d.veld" class="datum" :class="{ leeg: !project[d.veld], flits: flits === d.veld }">
      <span class="label">{{ d.naam }}</span>
      <input type="date" :value="project[d.veld] ?? ''" :aria-label="d.naam" @change="e => zet(d.veld, e)">
    </label>
  </div>
</template>

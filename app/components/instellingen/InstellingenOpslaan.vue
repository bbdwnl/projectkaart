<script setup lang="ts">
import { fmt } from '~/lib/datum'

// De balk onder een lijst in Instellingen: wie hem het laatst aanpaste, Opslaan, Ongedaan maken en Terug naar de standaard.
defineProps<{
  gewijzigd: boolean
  bezig: boolean
  isMt: boolean
  opgeslagen: { gewijzigd_door: string | null, gewijzigd_op: string } | null
}>()
defineEmits<{ opslaan: [], herstel: [], standaard: [] }>()
const tijd = (iso: string) => `${fmt(new Date(iso))} ${new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
</script>

<template>
  <div class="inst-opslaan" :class="{ gewijzigd }">
    <p class="klein">
      <template v-if="!isMt">Alleen het MT past dit aan.</template>
      <template v-else-if="gewijzigd"><b>Nog niet opgeslagen.</b></template>
      <template v-else-if="opgeslagen">Aangepast door {{ opgeslagen.gewijzigd_door ?? 'onbekend' }} · {{ tijd(opgeslagen.gewijzigd_op) }}</template>
      <template v-else>De standaard.</template>
    </p>
    <div v-if="isMt" class="knoppen">
      <button type="button" class="knop zwart klein" :disabled="!gewijzigd || bezig" @click="$emit('opslaan')">{{ bezig ? 'Opslaan…' : 'Opslaan' }}</button>
      <button v-if="gewijzigd" type="button" class="link" :disabled="bezig" @click="$emit('herstel')">Ongedaan maken</button>
      <button v-else-if="opgeslagen" type="button" class="link" :disabled="bezig" @click="$emit('standaard')">Terug naar de standaard</button>
    </div>
  </div>
</template>

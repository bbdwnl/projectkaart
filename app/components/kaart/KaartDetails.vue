<script setup lang="ts">
const { weergave } = useWeergave()
const { gebruiker } = useGebruiker()
const w = computed(() => weergave.value.details)
const geld = computed(() => w.value.geld && !!gebruiker.value?.isMt)
</script>

<template>
  <div id="paneel-details" class="paneel" role="tabpanel" aria-labelledby="tab-details">
    <Transition name="blok"><DetailsGegevens v-if="w.gegevens" /></Transition>
    <Transition name="blok"><DetailsFinancieel v-if="geld" /></Transition>
    <Transition name="blok"><DetailsLogboek v-if="w.logboek" /></Transition>
    <div v-if="!w.gegevens && !geld && !w.logboek" class="leeg-staat paneel-leeg">Alles op dit tabblad staat uit. Zet onderdelen aan via Weergave aanpassen.</div>
  </div>
</template>

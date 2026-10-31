<script setup lang="ts">
const { weergave } = useWeergave()
const w = computed(() => weergave.value.proces)
const toont = computed(() => w.value.flow || w.value.tijdlijn || w.value.datums)
</script>

<template>
  <div id="paneel-proces" class="paneel" role="tabpanel" aria-labelledby="tab-proces">
    <section v-if="toont" id="planning" class="blok">
      <ProcesTijdlijn />
    </section>
    <div v-else class="leeg-staat paneel-leeg">Alles op dit tabblad staat uit. Zet onderdelen aan via Weergave aanpassen.</div>
  </div>
</template>

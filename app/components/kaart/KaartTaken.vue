<script setup lang="ts">
const { weergave } = useWeergave()
</script>

<template>
  <div id="paneel-taken" class="paneel" role="tabpanel" aria-labelledby="tab-taken">
    <Transition name="blok">
      <TakenEerstDit v-if="weergave.taken.eerstDit" />
    </Transition>
    <TakenLijst />
  </div>
</template>

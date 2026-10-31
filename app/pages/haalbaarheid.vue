<script setup lang="ts">
// Haalbaarheid is een kolom op Projecten geworden. Een oude link of bladwijzer komt daar uit, met de kolom
// Haalbaarheid over de hele breedte; de prognose staat in het planningsoverzicht van Projecten.
definePageMeta({
  middleware: () => {
    useOverzichtWeergave().zet('haalbaarheid')
    return navigateTo('/', { replace: true })
  },
})
</script>

<template>
  <div />
</template>

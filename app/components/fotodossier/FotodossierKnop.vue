<script setup lang="ts">
// Een knop die op de telefoon meteen de camera opent (op de computer: een foto kiezen). Geeft het bestand door;
// verkleinen en opslaan doet FotodossierNieuw.
const emit = defineEmits<{ gekozen: [bestand: File] }>()

function kies(e: Event) {
  const veld = e.target as HTMLInputElement
  const bestand = veld.files?.[0]
  veld.value = '' // zodat dezelfde foto nog eens kiezen ook werkt
  if (bestand) emit('gekozen', bestand)
}
</script>

<template>
  <label class="fotodossier-knop">
    <input type="file" accept="image/*" capture="environment" class="verborgen" @change="kies">
    <slot />
  </label>
</template>

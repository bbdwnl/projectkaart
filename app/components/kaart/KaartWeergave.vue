<script setup lang="ts">
// Wat wil je zien? Alles wordt meteen bewaard in een cookie op dit apparaat.
// De keuzes zelf staan in WeergaveKeuzes; op mobiel staan ze in het menu (AppBalk).
const emit = defineEmits<{ sluit: [] }>()
const paneel = ref<HTMLElement>()

function buiten(e: MouseEvent) {
  if (paneel.value && !paneel.value.contains(e.target as Node)) emit('sluit')
}
function toets(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('sluit')
}
onMounted(() => {
  setTimeout(() => document.addEventListener('click', buiten))
  document.addEventListener('keydown', toets)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', buiten)
  document.removeEventListener('keydown', toets)
})
</script>

<template>
  <div ref="paneel" class="weergave" role="dialog" aria-label="Weergave aanpassen">
    <WeergaveKeuzes />
  </div>
</template>

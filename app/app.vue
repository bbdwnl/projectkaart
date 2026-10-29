<script setup lang="ts">
const route = useRoute()
const metBalk = computed(() => route.path !== '/login' && !route.meta.extern)
</script>

<template>
  <!-- De balk en de feedbackknop in een vaste schil (display: contents): zo voegt Vue ze bij het verlaten van /login
       niet in naast de pagina die op dat moment wisselt. Anders mislukt dat (insertBefore) en blijft de pagina leeg tot
       je ververst. -->
  <div class="schil"><AppBalk v-if="metBalk" /></div>
  <NuxtPage />
  <div class="schil"><AppFeedback v-if="metBalk" /></div>
  <AppToast />
</template>

<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <AppBalk v-if="route.path !== '/login'" />
  <NuxtPage />
  <AppToast />
</template>

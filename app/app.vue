<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <AppBalk v-if="route.path !== '/login' && !route.meta.extern" />
  <NuxtPage />
  <AppToast />
</template>

<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <AppBalk v-if="route.path !== '/login' && !route.meta.extern" />
  <NuxtPage />
  <AppFeedback v-if="route.path !== '/login' && !route.meta.extern" />
  <AppToast />
</template>

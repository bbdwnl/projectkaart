<script setup lang="ts">
const { melding } = useToast()
</script>

<template>
  <div class="toast-plek" aria-live="polite">
    <Transition name="toast">
      <div v-if="melding" :key="melding.id" class="toast" :class="melding.soort" role="status">
        <i /><span>{{ melding.tekst }}</span>
      </div>
    </Transition>
  </div>
</template>

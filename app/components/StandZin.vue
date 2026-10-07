<script setup lang="ts">
import type { ZinDeel } from '~/lib/stoplicht'

// De zin die het praten doet. Komt woord voor woord omhoog, en opnieuw als hij verandert.
const props = defineProps<{ delen: ZinDeel[] }>()

const woorden = computed(() => {
  let i = 0
  return props.delen.flatMap(d => d.tekst.split(/(\s+)/).filter(w => w !== '').map(w =>
    /^\s+$/.test(w) ? { spatie: true as const } : { spatie: false as const, tekst: w, licht: d.licht, i: i++ }))
})
const sleutel = computed(() => props.delen.map(d => d.tekst).join(''))
</script>

<template>
  <p class="zin" aria-live="polite">
    <span :key="sleutel">
      <template v-for="(w, n) in woorden" :key="n">
        <template v-if="w.spatie">{{ ' ' }}</template>
        <span v-else class="w" :class="w.licht" :style="{ '--i': w.i }">{{ w.tekst }}</span>
      </template>
    </span>
  </p>
</template>

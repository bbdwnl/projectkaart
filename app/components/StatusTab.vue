<script setup lang="ts">
import type { Licht } from '~/lib/types'

// De tab zegt de stand, altijd met een woord. Bij een nieuwe stand: een stempel.
const props = defineProps<{ licht: Licht | 'nu' | 'uitz' | 'gewoon', woord: string }>()
const el = ref<HTMLElement>()

watch(() => props.licht, (nieuw, oud) => {
  if (!el.value || !oud || nieuw === oud || minderBeweging()) return
  el.value.classList.remove('stempel')
  void el.value.offsetWidth
  el.value.classList.add('stempel')
})
</script>

<template>
  <span ref="el" class="tab" :class="licht === 'gewoon' ? '' : licht" @animationend="el?.classList.remove('stempel')">{{ woord }}</span>
</template>

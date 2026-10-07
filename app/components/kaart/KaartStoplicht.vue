<script setup lang="ts">
import { faseInfo } from '~/lib/fasen'

// Het stoplicht: drie lampen in de kleuren van het logo. Ze gaan één voor één aan.
const emit = defineEmits<{ kies: [licht: 'telaat' | 'letop' | 'klaar'] }>()
const { project, lichten } = useKaart()

const LAMPEN = [
  { licht: 'telaat', naam: 'Te laat', uitleg: 'Deadline voorbij' },
  { licht: 'letop', naam: 'Let op', uitleg: 'Binnen 14 dagen, zonder document of zonder reden' },
  { licht: 'klaar', naam: 'Klaar', uitleg: 'Definitief, met document' },
] as const
const tellers = {
  telaat: useTeller(() => lichten.value.telaat, { vertraging: 200 }),
  letop: useTeller(() => lichten.value.letop, { vertraging: 420 }),
  klaar: useTeller(() => lichten.value.klaar, { vertraging: 640 }),
}
const aan = ref(false)
onMounted(() => setTimeout(() => (aan.value = true), minderBeweging() ? 0 : 120))
const totaal = computed(() => lichten.value.telaat + lichten.value.letop + lichten.value.open + lichten.value.klaar)
const delen = computed(() => [
  { k: 'telaat', n: lichten.value.telaat }, { k: 'letop', n: lichten.value.letop },
  { k: 'klaar', n: lichten.value.klaar }, { k: 'open', n: lichten.value.open },
])
</script>

<template>
  <aside class="stoplicht" aria-label="Stoplicht van de huidige fase">
    <p class="label">Stoplicht · {{ faseInfo(project!.fase).naam }}</p>
    <div class="lampen">
      <button
        v-for="(l, i) in LAMPEN" :key="l.licht" type="button" class="lamp"
        :class="[l.licht, { aan: aan && lichten[l.licht] > 0 }]" :style="{ '--d': `${i * 220}ms` }"
        :aria-label="`${lichten[l.licht]} ${l.naam.toLowerCase()}: toon deze taken`" @click="emit('kies', l.licht)"
      >
        <i class="n">{{ tellers[l.licht].value }}</i>
        <span><b>{{ l.naam }}</b><small>{{ l.uitleg }}</small></span>
      </button>
    </div>
    <div class="balkje" aria-hidden="true">
      <span v-for="d in delen" :key="d.k" :class="`seg-${d.k}`" :style="{ flexGrow: aan ? d.n : (d.k === 'open' ? 1 : 0) }" />
    </div>
    <div class="voet">
      <span>{{ totaal }} taken in deze fase</span>
      <span v-if="lichten.later">{{ lichten.later }} n.v.t. of later</span>
    </div>
  </aside>
</template>

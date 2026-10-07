<script setup lang="ts">
import { DATUMVELDEN } from '~/lib/fasen'
import { dagen, fmt, naarDatum } from '~/lib/datum'

// De planningstrook in de kop: op elk tabblad zichtbaar. Klik = naar Proces & Planning.
const emit = defineEmits<{ open: [] }>()
const { project, mijlpaal, nu } = useKaart()

const as = computed(() => {
  const punten = DATUMVELDEN
    .map(d => ({ ...d, datum: naarDatum(project.value?.[d.veld]) }))
    .filter((p): p is typeof p & { datum: Date } => !!p.datum)
    .sort((a, b) => a.datum.getTime() - b.datum.getTime())
  if (!punten.length) return null
  const min = punten[0]!.datum.getTime()
  const max = punten.at(-1)!.datum.getTime()
  const pos = (d: Date) => 3 + Math.max(0, Math.min(1, (d.getTime() - min) / Math.max(1, max - min))) * 94
  const volgende = punten.find(p => p.datum >= nu)
  return {
    punten: punten.map((p, i) => ({
      ...p, pos: pos(p.datum), voorbij: p.datum < nu, volgende: p === volgende,
      uitlijn: i === 0 ? 'begin' : i === punten.length - 1 ? 'eind' : 'midden',
    })),
    vandaag: pos(nu),
    toonVandaag: nu.getTime() > min && nu.getTime() < max,
  }
})

const aftel = computed(() => {
  const m = mijlpaal.value
  if (!m) return ''
  return m.dagen >= 0 ? `Nog ${dagen(m.dagen)} tot ${m.naam}` : `${m.naam[0]!.toUpperCase()}${m.naam.slice(1)} was ${dagen(-m.dagen)} geleden`
})

const gevuld = ref(false)
onMounted(async () => {
  await volgendBeeld()
  gevuld.value = true
})
</script>

<template>
  <button class="strook" type="button" aria-label="Open Proces en Planning" @click="emit('open')">
    <span class="strook-kop">
      <span class="label">Planning</span>
      <b>{{ aftel }}</b>
      <span class="strook-link">Proces &amp; Planning →</span>
    </span>
    <span class="strook-as">
      <template v-if="as">
        <span class="basis" />
        <span class="vulling" :style="{ width: `${as.vandaag}%`, transform: gevuld ? 'scaleX(1)' : 'scaleX(0)' }" />
        <template v-for="p in as.punten" :key="p.veld">
          <span class="p" :class="{ voorbij: p.voorbij, volgende: p.volgende }" :style="{ left: `${p.pos}%` }" />
          <span class="t" :class="p.uitlijn" :style="{ left: `${p.pos}%` }">{{ p.kort }}<span class="n">{{ fmt(p.datum) }}</span></span>
        </template>
        <span v-if="as.toonVandaag" class="nu" :style="{ left: `${as.vandaag}%` }" title="Vandaag" />
      </template>
      <span v-else class="klein">Nog geen datums. Vul ze in bij Proces &amp; Planning.</span>
    </span>
  </button>
</template>

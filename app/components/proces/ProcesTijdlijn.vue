<script setup lang="ts">
import { DATUMVELDEN } from '~/lib/fasen'
import { fmt, naarDatum, plusDagen } from '~/lib/datum'

const { project, nu } = useKaart()
const KLEUR: Record<string, string> = { datum_voorbereiding: 'var(--zwart)', datum_inkoop: 'var(--blauw)', datum_afbouw: 'var(--salie)' }

const as = computed(() => {
  const punten = DATUMVELDEN
    .map(d => ({ ...d, datum: naarDatum(project.value?.[d.veld]) }))
    .filter((p): p is typeof p & { datum: Date } => !!p.datum)
    .sort((a, b) => a.datum.getTime() - b.datum.getTime())
  if (!punten.length) return null
  const min = plusDagen(punten[0]!.datum, -21).getTime()
  const max = plusDagen(punten.at(-1)!.datum, 21).getTime()
  const pos = (d: Date) => Math.max(0, Math.min(100, (d.getTime() - min) / (max - min) * 100))
  return {
    punten: punten.map(p => ({ ...p, pos: pos(p.datum), voorbij: p.datum < nu })),
    delen: punten.slice(0, -1).map((p, i) => ({ van: pos(p.datum), tot: pos(punten[i + 1]!.datum), kleur: KLEUR[p.veld] ?? '#bdbdb6' })),
    vandaag: pos(nu),
  }
})

const getekend = ref(false)
onMounted(async () => {
  await volgendBeeld()
  getekend.value = true
})
</script>

<template>
  <div class="tijdlijn" :class="{ klaar: getekend }">
    <div v-if="as" class="tl-as">
      <div class="basis" />
      <span v-for="(d, i) in as.delen" :key="i" class="tl-seg" :style="{ left: `${d.van}%`, width: `${d.tot - d.van}%`, background: d.kleur, transitionDelay: `${300 + i * 220}ms` }" />
      <template v-for="(p, i) in as.punten" :key="p.veld">
        <span class="tl-punt" :class="{ voorbij: p.voorbij }" :style="{ left: `${p.pos}%`, transitionDelay: `${250 + i * 160}ms` }" />
        <span class="tl-tekst" :class="{ onder: i % 2 }" :style="{ left: `${p.pos}%` }"><b>{{ p.naam }}</b><span class="n">{{ fmt(p.datum) }}</span></span>
      </template>
      <span class="tl-vandaag" :style="{ left: `${getekend ? as.vandaag : 0}%` }"><span>Vandaag</span></span>
    </div>
    <p v-else class="leeg-staat">Nog geen datums. Vul ze hieronder in; de deadlines rekenen mee.</p>
  </div>
</template>

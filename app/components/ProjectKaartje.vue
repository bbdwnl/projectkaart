<script setup lang="ts">
import type { Kaartje } from '~/lib/overzicht'
import { balkTekst, isAfgehandeld } from '~/lib/overzicht'
import { ROLLEN } from '~/lib/fasen'
import { fmt, naarDatum } from '~/lib/datum'

// Een project in een overzicht: alleen het nummer, de naam, de kleurenbalk van de taken en wie verantwoordelijk is
// (als chip, zoals op de kaart zelf; een stippelrand als er nog niemand is gekozen).
// De balk zegt zijn stand in woorden in de tooltip en voor schermlezers.
defineProps<{
  k: Kaartje
  volgorde?: number
  /** Een datum erbij, als het overzicht daarop sorteert (inkoop gereed of start afbouw). */
  datum?: { naam: string, waarde: string | null } | null
}>()
</script>

<template>
  <NuxtLink :to="`/projecten/${k.p.slug}`" class="kaart til projectkaartje" :class="{ afgehandeld: isAfgehandeld(k.p) }" :style="{ '--i': Math.min(volgorde ?? 0, 12) }">
    <span v-if="k.p.nummer" class="label n">{{ k.p.nummer }}</span>
    <h3>{{ k.p.naam }}</h3>
    <span v-if="isAfgehandeld(k.p)" class="tab afgehandeld-tab">Afgehandeld</span>
    <span class="mini-balk" role="img" :aria-label="balkTekst(k.t)" :title="balkTekst(k.t)">
      <span class="seg-telaat" :style="{ flexGrow: k.t.telaat }" /><span class="seg-letop" :style="{ flexGrow: k.t.letop }" />
      <span class="seg-klaar" :style="{ flexGrow: k.t.klaar }" /><span class="seg-open" :style="{ flexGrow: k.t.open }" />
    </span>
    <span class="chip wie" :class="{ leeg: !k.wie }" :title="ROLLEN[k.rol].naam">
      <span class="label">{{ ROLLEN[k.rol].kort }}</span><b v-if="k.wie">{{ k.wie }}</b><template v-else>nog niet gekozen</template>
    </span>
    <p v-if="datum" class="kaartje-datum klein">{{ datum.naam }}: {{ datum.waarde ? fmt(naarDatum(datum.waarde)) : 'geen datum' }}</p>
  </NuxtLink>
</template>

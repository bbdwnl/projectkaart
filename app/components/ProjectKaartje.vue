<script setup lang="ts">
import type { Kaartje } from '~/lib/overzicht'
import { balkTekst, dagenKort, isAfgehandeld, kaartjeInfo } from '~/lib/overzicht'
import { ROLLEN } from '~/lib/fasen'
import { fmt, naarDatum, vandaag } from '~/lib/datum'

// Een project in een overzicht: alleen het nummer, de naam, de kleurenbalk van de taken en wie verantwoordelijk is
// (als chip, zoals op de kaart zelf; een stippelrand als er nog niemand is gekozen).
// De balk zegt zijn stand in woorden in de tooltip en voor schermlezers.
// In de weergave Zakelijk (beslissing 45) een compacte versie met meer per regel: plaats en subfase, ook PM en
// opzichter, de taken in getallen en de volgende mijlpaal van de fase.
const props = defineProps<{
  k: Kaartje
  volgorde?: number
  /** Een datum erbij, als het overzicht daarop sorteert (inkoop gereed of start afbouw). */
  datum?: { naam: string, waarde: string | null } | null
}>()
const { zakelijk } = useThema()
const info = computed(() => (zakelijk.value ? kaartjeInfo(props.k, vandaag()) : null))
</script>

<template>
  <NuxtLink v-if="info" :to="`/projecten/${k.p.slug}`" class="kaart til projectkaartje zakelijk-kaartje" :data-licht="k.licht" :class="{ afgehandeld: isAfgehandeld(k.p), 'met-telaat': k.t.telaat > 0, prio: k.p.prio }" :style="{ '--i': Math.min(volgorde ?? 0, 12) }">
    <span v-if="k.p.nummer || k.p.prio || isAfgehandeld(k.p)" class="zk-kop">
      <span class="zk-nummer">{{ k.p.nummer }}</span>
      <span v-if="k.p.prio" class="tab telaat">Prio</span>
      <span v-if="isAfgehandeld(k.p)" class="tab">Afgehandeld</span>
    </span>
    <h3>{{ k.p.naam }}</h3>
    <span class="zk-regel zk-mensen">
      <span v-if="info.waar" class="zk-waar">{{ info.waar }}</span>
      <template v-if="info.mensen.length"><span v-for="m in info.mensen" :key="m.rol"><small>{{ m.rol }}</small> {{ m.naam }}</span></template>
      <span v-else class="zk-leeg">{{ ROLLEN[k.rol].kort }} nog niet gekozen</span>
    </span>
    <span class="mini-balk" role="img" :aria-label="balkTekst(k.t)" :title="balkTekst(k.t)">
      <span class="seg-telaat" :style="{ flexGrow: k.t.telaat }" /><span class="seg-letop" :style="{ flexGrow: k.t.letop }" />
      <span class="seg-klaar" :style="{ flexGrow: k.t.klaar }" /><span class="seg-open" :style="{ flexGrow: k.t.open }" />
    </span>
    <span class="zk-regel zk-cijfers" aria-hidden="true">
      <span v-if="k.t.telaat" class="telaat">{{ k.t.telaat }} te laat</span>
      <span v-if="k.t.letop" class="letop">{{ k.t.letop }} let op</span>
      <span v-if="k.t.open">{{ k.t.open }} open</span>
      <span class="klaar">{{ k.t.klaar }}/{{ info.totaal }} klaar</span>
    </span>
    <span v-if="datum" class="zk-regel zk-datum">{{ datum.naam }} <b>{{ datum.waarde ? fmt(naarDatum(datum.waarde)) : 'geen datum' }}</b></span>
    <span v-else-if="info.mijlpaal" class="zk-regel zk-datum">
      {{ info.mijlpaal.naam }} <b>{{ fmt(info.mijlpaal.datum) }}</b> · {{ dagenKort(info.mijlpaal.dagen) }}
    </span>
  </NuxtLink>
  <NuxtLink v-else :to="`/projecten/${k.p.slug}`" class="kaart til projectkaartje" :class="{ afgehandeld: isAfgehandeld(k.p), 'met-telaat': k.t.telaat > 0 }" :style="{ '--i': Math.min(volgorde ?? 0, 12) }">
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
    <p v-if="k.t.telaat || k.t.open" class="kaartje-telling klein">
      <span v-if="k.t.telaat" class="telling-telaat">{{ k.t.telaat }} te laat</span>
      <span v-if="k.t.open" class="telling-open">{{ k.t.open }} open</span>
    </p>
  </NuxtLink>
</template>

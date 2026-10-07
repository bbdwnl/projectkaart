<script setup lang="ts">
import { beschrijf } from '~/lib/logboek'
import { fmtMoment } from '~/lib/datum'

const { logboek, catalogus, nu } = useKaart()
const regels = computed(() => logboek.value.map(r => ({ ...r, delen: beschrijf(r, catalogus.value) })))
</script>

<template>
  <section id="logboek" class="blok">
    <div class="blokkop">
      <div>
        <h2>Wie wat wanneer veranderde</h2>
        <p class="klein">Elke wijziging in status, eigenaar, document, klantakkoord en de projectgegevens. Zo weet je of iets is afgetekend, en door wie.</p>
      </div>
    </div>
    <TransitionGroup v-if="regels.length" tag="ol" name="log" class="log">
      <li v-for="r in regels" :key="r.id">
        <time :datetime="r.op">{{ fmtMoment(r.op, nu) }}</time>
        <b>{{ r.door }}</b>{{ ' ' }}<template v-for="(d, i) in r.delen" :key="i"><b v-if="d.nadruk">{{ d.tekst }}</b><template v-else>{{ d.tekst }}</template></template>
      </li>
    </TransitionGroup>
    <div v-else class="leeg-staat">Nog niets veranderd. Elke wijziging komt hier te staan.</div>
  </section>
</template>

<script setup lang="ts">
import type { Project } from '~/lib/types'
import { signalen } from '~/lib/signalen'
import { vandaag } from '~/lib/datum'

// Aandachtspunten in de planning: wat opvalt aan de datums en de mensen van de lopende projecten (zoals in het
// prototype). Vragen om te beantwoorden, geen fouten die iets tegenhouden.
const props = defineProps<{ projecten: Project[] }>()
const lijst = computed(() => signalen(props.projecten, vandaag()))
const alles = ref(false)
const zichtbaar = computed(() => (alles.value ? lijst.value : lijst.value.slice(0, 6)))
const WOORD = { 'klopt-niet': 'Klopt niet', 'vraag': 'Vraag', 'ontbreekt': 'Ontbreekt' } as const
const LICHT = { 'klopt-niet': 'telaat', 'vraag': 'letop', 'ontbreekt': 'open' } as const
</script>

<template>
  <section v-if="lijst.length" class="signalen" aria-labelledby="signalen-kop">
    <header class="kolom-kop">
      <h2 id="signalen-kop">Aandachtspunten in de planning</h2>
      <span class="klein n">{{ lijst.length }}</span>
    </header>
    <ul>
      <li v-for="(s, i) in zichtbaar" :key="i">
        <StatusTab :licht="LICHT[s.soort]" :woord="WOORD[s.soort]" />
        <span>
          {{ s.tekst }}
          <template v-if="s.projecten.length > 1 || !s.tekst.startsWith(s.projecten[0]!.naam)">
            <br><template v-for="(p, j) in s.projecten" :key="p.slug"><NuxtLink :to="`/projecten/${p.slug}#proces`">{{ p.naam }}</NuxtLink><template v-if="j < s.projecten.length - 1"> · </template></template>
          </template>
          <template v-else> <NuxtLink :to="`/projecten/${s.projecten[0]!.slug}#proces`">Naar de planning</NuxtLink></template>
        </span>
      </li>
    </ul>
    <button v-if="lijst.length > 6" type="button" class="link" @click="alles = !alles">{{ alles ? 'Minder tonen' : `Alle ${lijst.length} tonen` }}</button>
  </section>
</template>

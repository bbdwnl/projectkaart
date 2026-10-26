<script setup lang="ts">
import { SOORTEN, type Signaal } from '~/lib/signalen'

// Aandachtspunten in de planning: wat opvalt aan de datums en de mensen van de lopende projecten (zoals in het
// prototype). Vragen om te beantwoorden, geen fouten die iets tegenhouden. Een tabblad naast het planningsoverzicht.
defineProps<{ lijst: Signaal[] }>()
</script>

<template>
  <section class="signalen" aria-label="Aandachtspunten in de planning">
    <p class="klein">Wat opvalt aan de datums en de mensen van de lopende projecten. Vragen om te beantwoorden, geen fouten die iets tegenhouden.</p>
    <ul v-if="lijst.length">
      <li v-for="(s, i) in lijst" :key="i">
        <StatusTab :licht="SOORTEN[s.soort].licht" :woord="SOORTEN[s.soort].woord" />
        <span>
          {{ s.tekst }}
          <template v-if="s.projecten.length > 1 || !s.tekst.startsWith(s.projecten[0]!.naam)">
            <br><template v-for="(p, j) in s.projecten" :key="p.slug"><NuxtLink :to="`/projecten/${p.slug}#proces`">{{ p.naam }}</NuxtLink><template v-if="j < s.projecten.length - 1"> · </template></template>
          </template>
          <template v-else> <NuxtLink :to="`/projecten/${s.projecten[0]!.slug}#proces`">Naar de planning</NuxtLink></template>
        </span>
      </li>
    </ul>
    <p v-else class="leeg-staat">Niets opvallends in de planning van de lopende projecten.</p>
  </section>
</template>

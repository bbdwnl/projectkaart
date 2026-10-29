<script setup lang="ts">
import { ROLLEN } from '~/lib/fasen'
import { ROL_IDS } from '~/lib/instellingen'

// Wie welke rol kan hebben (de keuzes in de chip op de kaart, bij een nieuw project en onder Details), wie eigenaar
// van een taak of actiehouder kan zijn, en wie buddy kan zijn.
const { concept, gewijzigd, bezig, isMt, opgeslagen, opslaan, standaardTerug, herstel } = useInstellingBewerken('mensen')
</script>

<template>
  <section class="blok instellingen">
    <div class="blokkop">
      <div>
        <h2>Mensen</h2>
        <p class="klein">Wie je per rol kunt kiezen. Haal je iemand weg, dan blijft hij staan op de projecten waar hij al op stond.</p>
      </div>
    </div>
    <fieldset class="kaal inst-raster" :disabled="!isMt">
      <div v-for="r in ROL_IDS" :key="r" class="kaart inst-kaart">
        <span class="tab">{{ ROLLEN[r].naam }}</span>
        <InstellingenNamen v-model="concept.rollen[r]" :label="ROLLEN[r].naam" />
      </div>
      <div class="kaart inst-kaart">
        <span class="tab">Eigenaar en actiehouder</span>
        <p class="klein">Bij een taak en bij een actie uit het overleg. De mensen van het project staan er altijd bij.</p>
        <InstellingenNamen v-model="concept.eigenaren" label="Eigenaar" voorbeeld="Naam of rol, bijvoorbeeld Architect" />
      </div>
      <div class="kaart inst-kaart">
        <span class="tab">Buddy</span>
        <p class="klein">Kijkt mee op een project; telt niet mee in het planningsoverzicht.</p>
        <InstellingenNamen v-model="concept.buddies" label="Buddy" />
      </div>
    </fieldset>
    <InstellingenOpslaan :gewijzigd="gewijzigd" :bezig="bezig" :is-mt="isMt" :opgeslagen="opgeslagen" @opslaan="opslaan" @herstel="herstel" @standaard="standaardTerug" />
  </section>
</template>

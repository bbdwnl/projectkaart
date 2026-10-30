<script setup lang="ts">
import type { Project, ProjectDiscipline } from '~/lib/types'
import { FASE_IDS, ROL_IDS, STATUS_IDS, standaard } from '~/lib/instellingen'

// De namen van statussen, fasen en rollen (die staan vast: het stoplicht en de planning rekenen ermee) en de lijsten
// die je vrij kunt uitbreiden: soort project, subfase van haalbaarheid en de disciplines in de uitvoering.
const { concept, gewijzigd, bezig, isMt, opgeslagen, opslaan, standaardTerug, herstel } = useInstellingBewerken('labels')
const bron = useBron()
const std = standaard().labels
const projecten = ref<Project[]>([])
const disciplines = ref<ProjectDiscipline[]>([])
onMounted(async () => {
  try {
    projecten.value = await bron.projecten()
    disciplines.value = (await Promise.all(projecten.value.map(p => bron.disciplines(p.id)))).flat()
  } catch { /* zonder telling */ }
})
const tel = (codes: (string | null)[]) => codes.reduce<Record<string, number>>((t, c) => (c ? { ...t, [c]: (t[c] ?? 0) + 1 } : t), {})
const soortGebruik = computed(() => tel(projecten.value.flatMap(p => p.soort)))
const subfaseGebruik = computed(() => tel(projecten.value.map(p => p.subfase)))
const disciplineGebruik = computed(() => tel(disciplines.value.filter(d => d.leverancier_id || d.contact).map(d => d.discipline)))
</script>

<template>
  <section class="blok instellingen">
    <div class="blokkop">
      <div>
        <h2>Keuzelijsten</h2>
        <p class="klein">Statussen, fasen en rollen staan vast, want het stoplicht en de planning rekenen ermee: naam en kleur pas je hier aan. Soorten, subfasen en disciplines vul je vrij aan.</p>
      </div>
    </div>
    <fieldset class="kaal inst-raster" :disabled="!isMt">
      <div class="kaart inst-kaart">
        <span class="tab">Status van een taak</span>
        <div class="inst-labels">
          <label v-for="s in STATUS_IDS" :key="s"><span class="klein">{{ std.statussen[s] }}</span><input v-model="concept.statussen[s]" class="veld" maxlength="40"></label>
        </div>
      </div>
      <div class="kaart inst-kaart">
        <span class="tab">Fasen</span>
        <p class="klein">Elke fase krijgt zijn eigen kleur. Die kleur staat terug op de plekken waar de fase langs komt: de kolommen, het planningsoverzicht en de tijdlijn op de kaart.</p>
        <div class="inst-fasen">
          <template v-for="f in FASE_IDS" :key="f">
            <label :aria-label="`Kleur van ${std.fasen[f].naam}`"><input v-model="concept.fasen[f].kleur" type="color" class="inst-kleur"></label>
            <label><span class="klein">{{ std.fasen[f].naam }}</span><input v-model="concept.fasen[f].naam" class="veld" maxlength="40"></label>
            <label><span class="klein">Wat er gebeurt</span><input v-model="concept.fasen[f].wat" class="veld" maxlength="80"></label>
          </template>
        </div>
      </div>
      <div class="kaart inst-kaart">
        <span class="tab">Rollen</span>
        <div class="inst-labels twee">
          <template v-for="r in ROL_IDS" :key="r">
            <label><span class="klein">{{ std.rollen[r].naam }}</span><input v-model="concept.rollen[r].naam" class="veld" maxlength="60"></label>
            <label><span class="klein">Kort</span><input v-model="concept.rollen[r].kort" class="veld" maxlength="20"></label>
          </template>
        </div>
      </div>
      <div class="kaart inst-kaart">
        <span class="tab">Soort project</span>
        <InstellingenKeuzes v-model="concept.soorten" label="Soort project" voorbeeld="Bijvoorbeeld Huurbegeleiding" :in-gebruik="soortGebruik" />
      </div>
      <div class="kaart inst-kaart">
        <span class="tab">Subfase haalbaarheid</span>
        <InstellingenKeuzes v-model="concept.subfasen" label="Subfase" :in-gebruik="subfaseGebruik" />
      </div>
      <div class="kaart inst-kaart">
        <span class="tab">Disciplines uitvoering</span>
        <InstellingenKeuzes v-model="concept.disciplines" label="Discipline" voorbeeld="Bijvoorbeeld Dakbedekking" :in-gebruik="disciplineGebruik" />
      </div>
    </fieldset>
    <InstellingenOpslaan :gewijzigd="gewijzigd" :bezig="bezig" :is-mt="isMt" :opgeslagen="opgeslagen" @opslaan="opslaan" @herstel="herstel" @standaard="standaardTerug" />
  </section>
</template>

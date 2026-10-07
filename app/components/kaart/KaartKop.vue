<script setup lang="ts">
import { FASEN, faseInfo, ROLLEN } from '~/lib/fasen'
import type { Fase } from '~/lib/types'

const emit = defineEmits<{ lamp: [licht: 'telaat' | 'letop' | 'klaar'], planning: [] }>()
const { project, zin, wijzigProject } = useKaart()
const { weergave } = useWeergave()

const rol = computed(() => faseInfo(project.value!.fase).rol)
const eigenaar = computed(() => project.value?.[rol.value] ?? null)
const label = computed(() => [project.value?.nummer, project.value?.afas_nummer && `AFAS ${project.value.afas_nummer}`, project.value?.plaats].filter(Boolean).join(' · '))

function kiesFase(e: Event) {
  const fase = (e.target as HTMLSelectElement).value as Fase
  wijzigProject({ fase }, `Fase aangepast: ${faseInfo(fase).naam}`)
}
</script>

<template>
  <div v-if="project" class="kop" :class="{ 'zonder-stoplicht': !weergave.kop.stoplicht }">
    <div>
      <div class="label">
        <span>{{ label }}</span>
        <span v-if="project.prio" class="tab telaat">Prio</span>
      </div>
      <h1>{{ project.naam }}</h1>
      <StandZin :delen="zin" />
      <div class="meta">
        <label class="chip"><span class="label">Fase</span>
          <select :value="project.fase" aria-label="Fase van het project" @change="kiesFase">
            <option v-for="f in FASEN" :key="f.id" :value="f.id">{{ f.naam }}</option>
          </select>
        </label>
        <span class="chip" :class="{ leeg: !eigenaar }">
          <span class="label">{{ ROLLEN[rol].kort }}</span>
          <b v-if="eigenaar">{{ eigenaar }}</b><template v-else>nog niet gekozen</template>
        </span>
        <a v-if="project.sharepoint_url" class="chip" :href="project.sharepoint_url" target="_blank" rel="noopener"><b>Projectmap in SharePoint ↗</b></a>
      </div>
      <Transition name="blok">
        <KaartStrook v-if="weergave.kop.planningstrook" @open="emit('planning')" />
      </Transition>
    </div>
    <Transition name="blok">
      <KaartStoplicht v-if="weergave.kop.stoplicht" @kies="l => emit('lamp', l)" />
    </Transition>
  </div>
</template>

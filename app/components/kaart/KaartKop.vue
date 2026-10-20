<script setup lang="ts">
import { FASEN, faseInfo, MENSEN, ROLLEN } from '~/lib/fasen'
import type { Fase } from '~/lib/types'

const emit = defineEmits<{ lamp: [licht: 'telaat' | 'letop' | 'klaar'], planning: [] }>()
const { project, zin, wijzigProject } = useKaart()
const { weergave } = useWeergave()

const rol = computed(() => faseInfo(project.value!.fase).rol)
const eigenaar = computed(() => project.value?.[rol.value] ?? null)
const label = computed(() => [project.value?.nummer, project.value?.plaats].filter(Boolean).join(' · '))

/** Wie de rol van deze fase kan hebben; ook iemand die er nu staat maar niet in de lijst. */
const keuzes = computed(() => [...new Set([...MENSEN[rol.value], ...(eigenaar.value ? [eigenaar.value] : [])])])
function kiesEigenaar(e: Event) {
  const naam = (e.target as HTMLSelectElement).value || null
  wijzigProject({ [rol.value]: naam }, naam ? `${ROLLEN[rol.value].kort}: ${naam}` : `${ROLLEN[rol.value].kort} weggehaald`)
}

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
        <label class="chip" :class="{ leeg: !eigenaar }"><span class="label">{{ ROLLEN[rol].kort }}</span>
          <select :value="eigenaar ?? ''" :aria-label="ROLLEN[rol].naam" @change="kiesEigenaar">
            <option value="">nog niet gekozen</option>
            <option v-for="m in keuzes" :key="m" :value="m">{{ m }}</option>
          </select>
        </label>
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

<script setup lang="ts">
import { FASEN, faseInfo, MENSEN, ROLLEN, SUBFASEN } from '~/lib/fasen'
import { isAfgehandeld } from '~/lib/overzicht'
import type { Fase, Subfase } from '~/lib/types'

const emit = defineEmits<{ lamp: [licht: 'telaat' | 'letop' | 'klaar'], planning: [] }>()
const { project, zin, wijzigProject } = useKaart()
const { weergave } = useWeergave()

const rol = computed(() => faseInfo(project.value!.fase).rol)
const eigenaar = computed(() => project.value?.[rol.value] ?? null)
const label = computed(() => [project.value?.nummer, project.value?.plaats].filter(Boolean).join(' · '))
/** Alleen een link naar http(s), zoals onder Details: een ander adres (javascript:) wordt geen link. */
const sharepoint = computed(() => (/^https?:\/\//i.test(project.value?.sharepoint_url ?? '') ? project.value!.sharepoint_url! : null))

/** Wie de rol van deze fase kan hebben; ook iemand die er nu staat maar niet in de lijst. */
const keuzes = computed(() => [...new Set([...MENSEN[rol.value], ...(eigenaar.value ? [eigenaar.value] : [])])])
function kiesEigenaar(e: Event) {
  const naam = (e.target as HTMLSelectElement).value || null
  wijzigProject({ [rol.value]: naam }, naam ? `${ROLLEN[rol.value].kort}: ${naam}` : `${ROLLEN[rol.value].kort} weggehaald`)
}

function kiesSubfase(e: Event) {
  const subfase = ((e.target as HTMLSelectElement).value || null) as Subfase | null
  wijzigProject({ subfase }, subfase ? `Subfase: ${SUBFASEN.find(s => s.id === subfase)!.naam}` : 'Subfase weggehaald')
}

function kiesFase(e: Event) {
  const fase = (e.target as HTMLSelectElement).value as Fase
  wijzigProject({ fase }, `Fase aangepast: ${faseInfo(fase).naam}`)
}
</script>

<template>
  <div v-if="project">
    <div class="kop" :class="{ 'zonder-stoplicht': !weergave.kop.stoplicht }">
      <div>
        <div class="label">
          <span>{{ label }}</span>
          <span v-if="project.prio" class="tab telaat">Prio</span>
          <span v-if="project.wachtkamer && project.fase === 'lead'" class="tab">Wachtkamer</span>
          <span v-if="isAfgehandeld(project)" class="tab">Afgehandeld</span>
        </div>
        <h1>{{ project.naam }}</h1>
        <StandZin :delen="zin" />
        <Transition name="blok">
          <KaartStrook v-if="weergave.kop.planningstrook" @open="emit('planning')" />
        </Transition>
      </div>
      <Transition name="blok">
        <KaartStoplicht v-if="weergave.kop.stoplicht" @kies="l => emit('lamp', l)" />
      </Transition>
    </div>
    <div class="meta">
      <label class="chip"><span class="label">Fase</span>
        <select :value="project.fase" aria-label="Fase van het project" @change="kiesFase">
          <option v-for="f in FASEN" :key="f.id" :value="f.id">{{ f.naam }}</option>
        </select>
      </label>
      <label v-if="project.fase === 'haalbaarheid'" class="chip" :class="{ leeg: !project.subfase }"><span class="label">Subfase</span>
        <select :value="project.subfase ?? ''" aria-label="Subfase van haalbaarheid" @change="kiesSubfase">
          <option value="">nog niet gekozen</option>
          <option v-for="s in SUBFASEN" :key="s.id" :value="s.id">{{ s.naam }}</option>
        </select>
      </label>
      <label class="chip" :class="{ leeg: !eigenaar }"><span class="label">{{ ROLLEN[rol].kort }}</span>
        <select :value="eigenaar ?? ''" :aria-label="ROLLEN[rol].naam" @change="kiesEigenaar">
          <option value="">nog niet gekozen</option>
          <option v-for="m in keuzes" :key="m" :value="m">{{ m }}</option>
        </select>
      </label>
      <a v-if="sharepoint" class="chip" :href="sharepoint" target="_blank" rel="noopener"><b>Projectmap in SharePoint ↗</b></a>
    </div>
  </div>
</template>

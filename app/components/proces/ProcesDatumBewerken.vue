<script setup lang="ts">
import type { ProjectDatums, ProjectPrognose } from '~/lib/types'
import { fmt, naarDatum, naarIso, plusDagen, plusMaand, vandaag } from '~/lib/datum'

// Eén datum aanpassen in een rustig venster: met een datumveld, een paar snelle keuzes en de gevolgen erbij.
const props = defineProps<{
  veld: keyof ProjectDatums | keyof ProjectPrognose
  naam: string
  waarde: string | null
  prognose?: boolean
}>()
const emit = defineEmits<{ sluit: [] }>()
const { wijzigProject } = useKaart()

const venster = ref<HTMLDialogElement>()
const veldInvoer = ref<HTMLInputElement>()
const invoer = ref(props.waarde ?? '')
const bezig = ref(false)

const gewijzigd = computed(() => (invoer.value || null) !== (props.waarde || null))
const gekozen = computed(() => {
  if (!invoer.value) return null
  const [y, m, d] = invoer.value.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
})
/** Voluit met de weekdag erbij, zodat je meteen ziet of de datum klopt. */
const voluit = computed(() => gekozen.value?.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) ?? 'Nog geen datum')
const uitleg = computed(() => props.prognose
  ? 'Deze verwachting staat in het planningsoverzicht en verandert geen deadlines.'
  : 'Deze datum stuurt de deadlines van de taken mee. Wat al klaar is, blijft staan.')

const vandaagDatum = vandaag()
const snel = [
  { naam: 'Vandaag', datum: naarIso(vandaagDatum) },
  { naam: 'Over 1 week', datum: naarIso(plusDagen(vandaagDatum, 7)) },
  { naam: 'Over 1 maand', datum: naarIso(plusMaand(vandaagDatum)) },
]

onMounted(() => {
  venster.value?.showModal()
  nextTick(() => veldInvoer.value?.focus())
})

const sluit = () => venster.value?.close()

async function opslaan() {
  if (!gewijzigd.value) return sluit()
  bezig.value = true
  const ok = await wijzigProject(
    { [props.veld]: invoer.value || null },
    props.prognose ? 'Prognose aangepast · in het planningsoverzicht' : 'Datum aangepast · deadlines rekenen mee',
  )
  bezig.value = false
  if (ok) sluit()
}

async function wis() {
  invoer.value = ''
  await opslaan()
}
</script>

<template>
  <dialog ref="venster" class="datumvenster" aria-labelledby="datumvenster-titel" @close="emit('sluit')" @click.self="sluit">
    <form class="datumvenster-in" @submit.prevent="opslaan">
      <header class="datumvenster-kop">
        <div>
          <p class="label">{{ prognose ? 'Prognose' : 'Harde datum' }}</p>
          <h2 id="datumvenster-titel">{{ naam }}</h2>
        </div>
        <button type="button" class="sluit-knop" aria-label="Sluiten" @click="sluit">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>
        </button>
      </header>

      <p class="klein">{{ uitleg }}</p>

      <label class="datumvenster-veld">
        <span class="label">Datum</span>
        <input ref="veldInvoer" v-model="invoer" type="date" class="veld" :aria-label="naam">
      </label>
      <p class="datumvenster-huidig klein">
        <template v-if="invoer">{{ voluit }}</template>
        <template v-else>Er staat nog geen datum.</template>
        <template v-if="props.waarde"> · nu {{ fmt(naarDatum(props.waarde)) }}</template>
      </p>

      <div class="datumvenster-snel" aria-label="Snelle keuzes">
        <button v-for="s in snel" :key="s.naam" type="button" class="knop klein" :class="{ zwart: invoer === s.datum }" @click="invoer = s.datum">{{ s.naam }}</button>
      </div>

      <div class="datumvenster-knoppen">
        <button type="submit" class="knop zwart" :disabled="bezig || !gewijzigd">{{ bezig ? 'Opslaan…' : 'Opslaan' }}</button>
        <button type="button" class="knop" @click="sluit">Annuleren</button>
        <button v-if="props.waarde || invoer" type="button" class="link" :disabled="bezig" @click="wis">Datum wissen</button>
      </div>
    </form>
  </dialog>
</template>

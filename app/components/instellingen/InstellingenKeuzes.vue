<script setup lang="ts">
import { nieuweCode, type Keuze } from '~/lib/instellingen'

// Een keuzelijst met een vaste code en een naam (soorten, subfasen, disciplines). De naam pas je aan; de code blijft,
// want daarmee staat de keuze op de projecten. Wat je weghaalt, blijft op de projecten staan waar het al op stond.
const keuzes = defineModel<Keuze[]>({ required: true })
const props = defineProps<{ label: string, voorbeeld?: string, inGebruik?: Record<string, number> }>()
const nieuw = ref('')

function voegToe() {
  const naam = nieuw.value.trim().replace(/\s+/g, ' ')
  if (!naam) return
  keuzes.value = [...keuzes.value, { id: nieuweCode(naam, keuzes.value.map(k => k.id)), naam }]
  nieuw.value = ''
}
function hernoem(i: number, e: Event) {
  const invoer = e.target as HTMLInputElement
  const naam = invoer.value.trim().replace(/\s+/g, ' ')
  if (!naam) {
    invoer.value = keuzes.value[i]!.naam
    return
  }
  keuzes.value = keuzes.value.map((k, j) => (j === i ? { ...k, naam } : k))
}
function schuif(i: number, d: -1 | 1) {
  const l = [...keuzes.value]
  ;[l[i], l[i + d]] = [l[i + d]!, l[i]!]
  keuzes.value = l
}
function weg(i: number) {
  const k = keuzes.value[i]!
  const n = props.inGebruik?.[k.id] ?? 0
  if (n && !confirm(`${k.naam} staat op ${n === 1 ? 'één project' : `${n} projecten`}. Daar blijft het staan, maar je kiest het niet meer. Weghalen?`)) return
  keuzes.value = keuzes.value.filter((_, j) => j !== i)
}
</script>

<template>
  <div class="inst-lijst">
    <ol v-if="keuzes.length" class="inst-items">
      <li v-for="(k, i) in keuzes" :key="k.id">
        <input class="veld" :value="k.naam" :aria-label="`${props.label}: ${k.naam}`" @change="e => hernoem(i, e)">
        <span class="inst-knopjes">
          <small v-if="inGebruik?.[k.id]" class="klein n" :title="`Staat op ${inGebruik[k.id]} projecten`">{{ inGebruik[k.id] }}×</small>
          <button type="button" class="ikoon" :disabled="i === 0" :aria-label="`${k.naam} omhoog`" title="Omhoog" @click="schuif(i, -1)">↑</button>
          <button type="button" class="ikoon" :disabled="i === keuzes.length - 1" :aria-label="`${k.naam} omlaag`" title="Omlaag" @click="schuif(i, 1)">↓</button>
          <button type="button" class="ikoon" :aria-label="`${k.naam} weghalen`" title="Weghalen" @click="weg(i)">✕</button>
        </span>
      </li>
    </ol>
    <p v-else class="klein">Nog niets.</p>
    <form class="inst-nieuw" @submit.prevent="voegToe">
      <input v-model="nieuw" class="veld" :placeholder="voorbeeld ?? 'Naam'" :aria-label="`Nieuw bij ${label}`">
      <button type="submit" class="knop klein" :disabled="!nieuw.trim()">Toevoegen</button>
    </form>
  </div>
</template>

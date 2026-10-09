<script setup lang="ts">
import type { Tekening } from '~/lib/types'
import { pinsVan } from '~/lib/tekening'
import { fmt } from '~/lib/datum'

// De tekeningen van dit project (pdf). Onder Controle zet je een aandachtspunt op de plek waar het om gaat.
const { tekeningen, controlepunten, nummers, uploadTekening, hernoemTekening, verwijderTekening } = useKaart()
const uploaden = ref(false)
const bekijk = ref<string | null>(null)

const pins = computed(() => pinsVan(controlepunten.value, p => nummers.value.get(p.id) ?? '?'))
const punten = (id: string) => controlepunten.value.filter(p => p.tekening_id === id).length

async function upload(e: Event) {
  const veld = e.target as HTMLInputElement
  const bestanden = [...(veld.files ?? [])]
  veld.value = ''
  uploaden.value = true
  for (const b of bestanden) await uploadTekening(b)
  uploaden.value = false
}
function hernoem(t: Tekening, e: Event) {
  const invoer = e.target as HTMLInputElement
  const naam = invoer.value.trim()
  if (!naam) {
    invoer.value = t.naam
    return
  }
  if (naam !== t.naam) hernoemTekening(t, naam)
}
async function weg(t: Tekening) {
  if (confirm(`${t.naam} weghalen? De pdf gaat ook weg.`)) await verwijderTekening(t)
}
</script>

<template>
  <section id="tekeningen" class="blok">
    <div class="blokkop">
      <div>
        <h2>Tekeningen</h2>
        <p class="klein">Plattegronden en gevels als pdf. Onder Controle zet je een aandachtspunt op de plek waar het om gaat. Een tekening uit SharePoint download je eerst en upload je hier.</p>
      </div>
      <label class="knop" :class="{ bezig: uploaden }">
        <input type="file" accept="application/pdf,.pdf" multiple class="verborgen" :disabled="uploaden" @change="upload">
        {{ uploaden ? 'Uploaden…' : 'Tekening uploaden (pdf)' }}
      </label>
    </div>
    <div v-if="tekeningen.length" class="lijst tekeninglijst">
      <div class="kolkop"><span>Naam</span><span>Toegevoegd</span><span>Aandachtspunten</span><span /></div>
      <div v-for="t in tekeningen" :key="t.id" class="rij">
        <div class="rij-hoofd">
          <input class="veld" :value="t.naam" :aria-label="`Naam van ${t.naam}`" @change="e => hernoem(t, e)">
          <span class="klein">{{ t.aangemaakt_door ?? 'Onbekend' }} · {{ fmt(new Date(t.aangemaakt_op)) }}</span>
          <span class="klein">{{ punten(t.id) || 'Geen' }}</span>
          <span class="acties">
            <button type="button" class="knop klein" @click="bekijk = t.id">Bekijken</button>
            <button type="button" class="link" :disabled="punten(t.id) > 0" :title="punten(t.id) ? 'Er staan aandachtspunten op deze tekening' : undefined" @click="weg(t)">Weghalen</button>
          </span>
        </div>
      </div>
    </div>
    <div v-else class="leeg-staat">Nog geen tekeningen. Upload een plattegrond als pdf; daarna kun je bij een aandachtspunt de plek aanwijzen.</div>

    <TekeningViewer v-if="bekijk" :tekeningen="tekeningen" :tekening-id="bekijk" :pins="pins" titel="Tekening" @sluit="bekijk = null" />
  </section>
</template>

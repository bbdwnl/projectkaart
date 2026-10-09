<script setup lang="ts">
import type { Leverancier } from '~/lib/types'

// De leveranciers van dit project: gekozen uit de globale lijst, of alleen voor dit project aangemaakt.
// Onder Controle koppel je een aandachtspunt aan een van deze leveranciers.
const { leveranciers, globaleLeveranciers, controlepunten, nieuweLeverancier, koppelLeverancier, ontkoppelLeverancier, maakGlobaal } = useKaart()
const { toon } = useToast()
const gekozen = ref('')
const naam = ref('')
const vak = ref('')
const ookGlobaal = ref(false)
const bezig = ref(false)

/** Uit de globale lijst, behalve wat al op dit project staat. */
const tekiezen = computed(() => globaleLeveranciers.value.filter(g => !leveranciers.value.some(l => l.id === g.id)))

const punten = (id: string) => {
  const ps = controlepunten.value.filter(p => p.leverancier_id === id)
  return { totaal: ps.length, open: ps.filter(p => !p.opgelost).length }
}
const puntenTekst = (id: string) => {
  const { totaal, open } = punten(id)
  return totaal ? `${open} open, ${totaal - open} opgelost` : 'Geen'
}

async function kies() {
  const l = tekiezen.value.find(x => x.id === gekozen.value)
  if (!l) return toon('Kies een leverancier uit de lijst.', 'fout')
  bezig.value = true
  if (await koppelLeverancier(l)) gekozen.value = ''
  bezig.value = false
}
async function maak() {
  if (naam.value.trim().length < 2) return toon('Geef de leverancier een naam van minstens twee letters.', 'fout')
  bezig.value = true
  if (await nieuweLeverancier({ naam: naam.value.trim(), vak: vak.value.trim() || null, globaal: ookGlobaal.value })) {
    naam.value = ''
    vak.value = ''
    ookGlobaal.value = false
  }
  bezig.value = false
}
async function weg(l: Leverancier) {
  const vraag = l.globaal
    ? `${l.naam} weghalen bij dit project? Hij blijft in de globale lijst staan.`
    : `${l.naam} weghalen? Hij staat alleen bij dit project en is daarna helemaal weg.`
  if (confirm(vraag)) await ontkoppelLeverancier(l)
}
</script>

<template>
  <section id="leveranciers" class="blok">
    <div class="blokkop">
      <div>
        <h2>Leveranciers</h2>
        <p class="klein">Wie op dit project levert of bouwt. Kies uit de globale lijst, of maak er een alleen voor dit project. Onder Controle koppel je een aandachtspunt aan de leverancier die het oplost.</p>
      </div>
    </div>
    <div v-if="leveranciers.length" class="lijst leverancierlijst">
      <div class="kolkop"><span>Leverancier</span><span>Wat ze doen</span><span>Lijst</span><span>Aandachtspunten</span><span /></div>
      <div v-for="l in leveranciers" :key="l.id" class="rij">
        <div class="rij-hoofd">
          <span class="titel">{{ l.naam }}</span>
          <span>{{ l.vak ?? '—' }}</span>
          <span class="klein">{{ l.globaal ? 'Globaal' : 'Alleen dit project' }}</span>
          <span class="klein">{{ puntenTekst(l.id) }}</span>
          <span class="acties">
            <button v-if="!l.globaal" type="button" class="link" @click="maakGlobaal(l)">Ook globaal</button>
            <button type="button" class="link" :disabled="punten(l.id).totaal > 0" :title="punten(l.id).totaal ? 'Heeft aandachtspunten onder Controle' : undefined" @click="weg(l)">Weghalen</button>
          </span>
        </div>
      </div>
    </div>
    <div v-else class="leeg-staat">Nog geen leveranciers op dit project. Kies ze hieronder uit de globale lijst, of maak een nieuwe.</div>

    <div class="leverancier-toevoegen">
      <form class="kaart" @submit.prevent="kies">
        <span class="tab">Uit de globale lijst</span>
        <select v-model="gekozen" class="veld" aria-label="Leverancier uit de globale lijst" :disabled="!tekiezen.length">
          <option value="">{{ tekiezen.length ? 'Kies een leverancier' : globaleLeveranciers.length ? 'Alle staan al bij dit project' : 'De globale lijst is nog leeg' }}</option>
          <option v-for="l in tekiezen" :key="l.id" :value="l.id">{{ l.naam }}{{ l.vak ? ` · ${l.vak}` : '' }}</option>
        </select>
        <button type="submit" class="knop" :disabled="bezig || !gekozen">Toevoegen</button>
      </form>
      <form class="kaart" @submit.prevent="maak">
        <span class="tab">Nieuwe leverancier</span>
        <input v-model="naam" class="veld" placeholder="Naam, bijvoorbeeld Klimaattechniek Oost" aria-label="Naam van de leverancier">
        <input v-model="vak" class="veld" placeholder="Wat ze doen, bijvoorbeeld installateur" aria-label="Wat de leverancier doet">
        <label class="schakel"><input v-model="ookGlobaal" type="checkbox"><span />Ook in de globale lijst</label>
        <button type="submit" class="knop" :disabled="bezig">Toevoegen</button>
      </form>
    </div>
  </section>
</template>

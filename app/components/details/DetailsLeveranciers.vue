<script setup lang="ts">
import type { Leverancier } from '~/lib/types'

// De leveranciers van dit project. Onder Controle kies je er bij elk aandachtspunt een.
const { leveranciers, controlepunten, voegLeverancierToe, verwijderLeverancier } = useKaart()
const { toon } = useToast()
const naam = ref('')
const vak = ref('')
const bezig = ref(false)

const punten = (id: string) => {
  const ps = controlepunten.value.filter(p => p.leverancier_id === id)
  return { totaal: ps.length, open: ps.filter(p => !p.opgelost).length }
}
const puntenTekst = (id: string) => {
  const { totaal, open } = punten(id)
  return totaal ? `${open} open, ${totaal - open} opgelost` : 'Geen'
}

async function voegToe() {
  if (naam.value.trim().length < 2) return toon('Geef de leverancier een naam van minstens twee letters.', 'fout')
  bezig.value = true
  if (await voegLeverancierToe({ naam: naam.value.trim(), vak: vak.value.trim() || null })) {
    naam.value = ''
    vak.value = ''
  }
  bezig.value = false
}
async function weg(l: Leverancier) {
  if (confirm(`${l.naam} weghalen bij dit project?`)) await verwijderLeverancier(l)
}
</script>

<template>
  <section id="leveranciers" class="blok">
    <div class="blokkop">
      <div>
        <h2>Leveranciers</h2>
        <p class="klein">Wie op dit project levert of bouwt. Bij elk aandachtspunt onder Controle kies je er een, zodat per leverancier te zien is wat er nog openstaat.</p>
      </div>
    </div>
    <div v-if="leveranciers.length" class="lijst leverancierlijst">
      <div class="kolkop"><span>Leverancier</span><span>Wat ze doen</span><span>Aandachtspunten</span><span /></div>
      <div v-for="l in leveranciers" :key="l.id" class="rij">
        <div class="rij-hoofd">
          <span class="titel">{{ l.naam }}</span>
          <span>{{ l.vak ?? '—' }}</span>
          <span class="klein">{{ puntenTekst(l.id) }}</span>
          <span class="acties">
            <button type="button" class="link" :disabled="punten(l.id).totaal > 0" :title="punten(l.id).totaal ? 'Heeft aandachtspunten onder Controle' : undefined" @click="weg(l)">Weghalen</button>
          </span>
        </div>
      </div>
    </div>
    <div v-else class="leeg-staat">Nog geen leveranciers. Voeg ze hieronder toe; daarna kun je onder Controle aandachtspunten maken.</div>
    <form class="leverancier-nieuw" @submit.prevent="voegToe">
      <input v-model="naam" class="veld" placeholder="Naam, bijvoorbeeld Klimaattechniek Oost" aria-label="Naam van de leverancier">
      <input v-model="vak" class="veld" placeholder="Wat ze doen, bijvoorbeeld installateur" aria-label="Wat de leverancier doet">
      <button type="submit" class="knop" :disabled="bezig">Toevoegen</button>
    </form>
  </section>
</template>

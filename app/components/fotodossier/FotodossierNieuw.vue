<script setup lang="ts">
// Een nieuwe foto voor het fotodossier: de foto zie je groot, de titel is optioneel. Open met toon(bestand),
// vanuit de knop onder Fotodossier of de cameraknop op de telefoon.
const { voegDossierfotoToe } = useKaart()
const { toon: melding } = useToast()
const venster = ref<HTMLDialogElement>()
const foto = ref<Blob | null>(null)
const voorbeeld = ref<string | null>(null)
const titel = ref('')
const verwerken = ref(false)
const bezig = ref(false)

function zetVoorbeeld(url: string | null) {
  if (voorbeeld.value) URL.revokeObjectURL(voorbeeld.value)
  voorbeeld.value = url
}

async function toon(bestand: File) {
  if (!bestand.type.startsWith('image/')) return melding('Kies een foto.', 'fout')
  if (!venster.value?.open) {
    titel.value = ''
    venster.value?.showModal()
  }
  verwerken.value = true
  try {
    foto.value = await verkleinFoto(bestand)
    zetVoorbeeld(URL.createObjectURL(foto.value))
  } catch {
    melding('Deze foto kan niet worden gelezen. Probeer een andere.', 'fout')
    if (!foto.value) venster.value?.close()
  } finally {
    verwerken.value = false
  }
}
defineExpose({ toon })

function opruimen() {
  foto.value = null
  zetVoorbeeld(null)
}
onBeforeUnmount(opruimen)

async function bewaar() {
  if (!foto.value || bezig.value) return
  bezig.value = true
  const gelukt = await voegDossierfotoToe(foto.value, titel.value)
  bezig.value = false
  if (gelukt) venster.value?.close()
}
</script>

<template>
  <dialog ref="venster" class="fotovenster dossier-nieuw" aria-labelledby="dossier-nieuw-kop" @close="opruimen">
    <form @submit.prevent="bewaar">
      <h2 id="dossier-nieuw-kop">Foto voor het fotodossier</h2>
      <div class="dossier-voorbeeld">
        <img v-if="voorbeeld" :src="voorbeeld" alt="De nieuwe foto">
        <span v-else>Foto verwerken…</span>
      </div>
      <label class="dossier-titel"><span class="label">Titel (optioneel)</span>
        <input v-model="titel" class="veld" maxlength="200" enterkeyhint="done" placeholder="Bijvoorbeeld: leidingwerk vloer 2e verdieping, vóór het storten">
      </label>
      <div class="knoppen">
        <button type="submit" class="knop zwart" :disabled="bezig || verwerken || !foto" autofocus>{{ bezig ? 'Opslaan…' : 'Opslaan' }}</button>
        <FotodossierKnop class="link" @gekozen="toon">Andere foto</FotodossierKnop>
        <button type="button" class="link" @click="venster?.close()">Annuleren</button>
      </div>
    </form>
  </dialog>
</template>

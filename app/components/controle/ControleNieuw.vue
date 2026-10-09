<script setup lang="ts">
// Een nieuw aandachtspunt: foto, notitie en leverancier zijn alle drie verplicht.
const emit = defineEmits<{ klaar: [] }>()
const { leveranciers, voegControlepuntToe } = useKaart()
const { weergave } = useWeergave()
const { toon } = useToast()
const invoer = ref<HTMLInputElement>()
const foto = ref<Blob | null>(null)
const voorbeeld = ref<string | null>(null)
const notitie = ref('')
const leverancierId = ref(leveranciers.value.length === 1 ? leveranciers.value[0]!.id : '')
const verwerken = ref(false)
const bezig = ref(false)

async function kies(e: Event) {
  const veld = e.target as HTMLInputElement
  const bestand = veld.files?.[0]
  veld.value = '' // zodat dezelfde foto nog eens kiezen ook werkt
  if (!bestand) return
  if (!bestand.type.startsWith('image/')) return toon('Kies een foto.', 'fout')
  verwerken.value = true
  try {
    foto.value = await verkleinFoto(bestand)
    if (voorbeeld.value) URL.revokeObjectURL(voorbeeld.value)
    voorbeeld.value = URL.createObjectURL(foto.value)
  } catch {
    toon('Deze foto kan niet worden gelezen. Probeer een andere.', 'fout')
  } finally {
    verwerken.value = false
  }
}
onBeforeUnmount(() => { if (voorbeeld.value) URL.revokeObjectURL(voorbeeld.value) })

async function bewaar() {
  if (!foto.value) return toon('Maak eerst een foto.', 'fout')
  if (notitie.value.trim().length < 2) return toon('Schrijf erbij wat er aan de hand is.', 'fout')
  if (!leverancierId.value) return toon('Kies de leverancier die het oplost.', 'fout')
  bezig.value = true
  const gelukt = await voegControlepuntToe({ leverancierId: leverancierId.value, notitie: notitie.value.trim(), foto: foto.value })
  bezig.value = false
  if (gelukt) emit('klaar')
}

/** Naar Details, waar de leveranciers staan. Het tabblad schuift eerst in beeld, dan de leveranciers. */
function naarLeveranciers() {
  weergave.value.details.leveranciers = true
  weergave.value.tab = 'details'
  setTimeout(() => document.getElementById('leveranciers')?.scrollIntoView({ behavior: minderBeweging() ? 'auto' : 'smooth', block: 'start' }), 450)
}
</script>

<template>
  <form class="kaart controle-nieuw" @submit.prevent="bewaar">
    <span class="tab nu">Nieuw aandachtspunt</span>
    <div class="foto-veld">
      <label class="fotoknop" :class="{ gevuld: voorbeeld }">
        <input ref="invoer" type="file" accept="image/*" capture="environment" class="verborgen" @change="kies">
        <img v-if="voorbeeld" :src="voorbeeld" alt="De foto bij dit aandachtspunt">
        <span v-else>{{ verwerken ? 'Foto verwerken…' : 'Maak een foto' }}</span>
      </label>
      <button v-if="voorbeeld" type="button" class="link" @click="invoer?.click()">Andere foto</button>
    </div>
    <div class="controle-velden">
      <label><span class="label">Notitie</span>
        <textarea v-model="notitie" class="veld" rows="3" placeholder="Wat is er mis, en waar? Bijvoorbeeld: kitnaad bij kozijn spreekkamer 2 niet afgewerkt." />
      </label>
      <label v-if="leveranciers.length"><span class="label">Leverancier</span>
        <select v-model="leverancierId" class="veld">
          <option value="" disabled>Kies de leverancier die het oplost</option>
          <option v-for="l in leveranciers" :key="l.id" :value="l.id">{{ l.naam }}{{ l.vak ? ` · ${l.vak}` : '' }}</option>
        </select>
      </label>
      <p v-else class="geen-leveranciers klein">Dit project heeft nog geen leveranciers. <button type="button" class="link" @click="naarLeveranciers">Stel ze in bij Details</button></p>
      <div class="knoppen">
        <button type="submit" class="knop zwart" :disabled="bezig || verwerken">{{ bezig ? 'Opslaan…' : 'Opslaan' }}</button>
        <button type="button" class="link" @click="emit('klaar')">Annuleren</button>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { Plek } from '~/lib/types'
import { pinsVan, type BladPlek } from '~/lib/tekening'

// Een nieuw aandachtspunt: foto en notitie zijn verplicht, de leverancier en de plek op een tekening niet
// (die kunnen later in de lijst).
const emit = defineEmits<{ klaar: [] }>()
const { leveranciers, voegControlepuntToe, tekeningen, controlepunten, nummers, uploadTekening } = useKaart()
const { weergave } = useWeergave()
const { toon } = useToast()
const invoer = ref<HTMLInputElement>()
const foto = ref<Blob | null>(null)
const voorbeeld = ref<string | null>(null)
const notitie = ref('')
const leverancierId = ref('')
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

// ---------- plek op een tekening ----------
const plek = ref<Plek | null>(null)
const viewerTekening = ref<string | null>(null)
const uploaden = ref(false)
const pins = computed(() => pinsVan(controlepunten.value, p => nummers.value.get(p.id) ?? '?'))
const plekTekst = computed(() => {
  if (!plek.value) return ''
  const t = tekeningen.value.find(x => x.id === plek.value!.tekening_id)
  return `${t?.naam ?? 'Tekening'}, blad ${plek.value.tekening_blad}`
})
const plekVoorViewer = computed(() => plek.value ? { tekening_id: plek.value.tekening_id, blad: plek.value.tekening_blad, x: plek.value.tekening_x, y: plek.value.tekening_y } : null)
function wijsAan() {
  viewerTekening.value = plek.value?.tekening_id ?? tekeningen.value[0]?.id ?? null
}
function plekGekozen(p: BladPlek & { tekening_id: string }) {
  plek.value = { tekening_id: p.tekening_id, tekening_blad: p.blad, tekening_x: p.x, tekening_y: p.y }
}
/** Een pdf uploaden en meteen de plek laten aanwijzen. */
async function uploadPdf(e: Event) {
  const veld = e.target as HTMLInputElement
  const bestand = veld.files?.[0]
  veld.value = ''
  if (!bestand) return
  uploaden.value = true
  const t = await uploadTekening(bestand)
  uploaden.value = false
  if (t) viewerTekening.value = t.id
}

async function bewaar() {
  if (!foto.value) return toon('Maak eerst een foto.', 'fout')
  if (notitie.value.trim().length < 2) return toon('Schrijf erbij wat er aan de hand is.', 'fout')
  bezig.value = true
  const gelukt = await voegControlepuntToe({ leverancierId: leverancierId.value || null, notitie: notitie.value.trim(), foto: foto.value, plek: plek.value })
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
      <label v-if="leveranciers.length"><span class="label">Leverancier (optioneel)</span>
        <select v-model="leverancierId" class="veld">
          <option value="">Nog geen leverancier</option>
          <option v-for="l in leveranciers" :key="l.id" :value="l.id">{{ l.naam }}{{ l.vak ? ` · ${l.vak}` : '' }}</option>
        </select>
      </label>
      <p v-else class="geen-leveranciers klein">Dit project heeft nog geen leveranciers. Dat hoeft niet: je kiest er later een in de lijst. <button type="button" class="link" @click="naarLeveranciers">Leveranciers instellen bij Details</button></p>
      <div class="plek-veld">
        <span class="label">Plek op tekening (optioneel)</span>
        <p v-if="plek" class="plek-gekozen">
          <span>{{ plekTekst }} · plek gekozen</span>
          <button type="button" class="link" @click="wijsAan">Wijzigen</button>
          <button type="button" class="link" @click="plek = null">Weghalen</button>
        </p>
        <div v-else class="plek-knoppen">
          <button v-if="tekeningen.length" type="button" class="knop klein" @click="wijsAan">Plek aanwijzen op tekening</button>
          <label class="knop klein" :class="{ bezig: uploaden }">
            <input type="file" accept="application/pdf,.pdf" class="verborgen" :disabled="uploaden" @change="uploadPdf">
            {{ uploaden ? 'Uploaden…' : tekeningen.length ? 'Andere tekening uploaden (pdf)' : 'Tekening uploaden (pdf)' }}
          </label>
        </div>
      </div>
      <div class="knoppen">
        <button type="submit" class="knop zwart" :disabled="bezig || verwerken">{{ bezig ? 'Opslaan…' : 'Opslaan' }}</button>
        <button type="button" class="link" @click="emit('klaar')">Annuleren</button>
      </div>
    </div>
    <TekeningViewer
      v-if="viewerTekening" :tekeningen="tekeningen" :tekening-id="viewerTekening" :pins="pins" markeren :plek="plekVoorViewer"
      titel="Wijs de plek aan" @kies="plekGekozen" @sluit="viewerTekening = null"
    />
  </form>
</template>

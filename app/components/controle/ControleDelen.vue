<script setup lang="ts">
import type { Deellink } from '~/lib/types'
import { actieveLink, deelTekst, laatsteLink, linkAdres, STAND_TEKST, standVan } from '~/lib/deellink'
import { fmt, fmtMoment, plusMaand } from '~/lib/datum'

// Delen met iemand buiten BbDW. De pdf van wat je ziet: via delen op de telefoon (mail, WhatsApp) of downloaden.
// En een link voor een leverancier naar een eigen pagina met alleen zijn open punten, per project en in totaal,
// met de tekeningen. De link is een maand geldig, vraagt een code van vijf cijfers en gaat dicht zodra alles is opgelost.
const props = defineProps<{
  /** De leveranciers met open punten, met hoeveel. */
  leveranciers: { id: string, naam: string, open: number }[]
  /** Met wie je begint: uit de keuze op de pagina. */
  start: string | null
  links: Deellink[]
  /** De pdf van de selectie op de pagina. */
  pdf: { omschrijving: string, aantal: number, maak: () => Promise<{ blob: Blob, naam: string }> }
}>()
const emit = defineEmits<{ sluit: [], link: [link: Deellink] }>()
const bron = useBron()
const { gebruiker, modus } = useGebruiker()
const { toon } = useToast()
const venster = ref<HTMLDialogElement>()
onMounted(() => venster.value?.showModal())
const sluit = () => venster.value?.close()
const datum = (iso: string) => fmt(new Date(iso))

// ---------- pdf ----------
const pdfStand = ref<'leeg' | 'bezig' | 'klaar'>('leeg')
const bestand = shallowRef<File | null>(null)
const kanBestandDelen = computed(() => !!bestand.value && typeof navigator.canShare === 'function' && navigator.canShare({ files: [bestand.value] }))
const grootte = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`)
async function maakPdf() {
  pdfStand.value = 'bezig'
  try {
    const { blob, naam } = await props.pdf.maak()
    bestand.value = new File([blob], naam, { type: 'application/pdf' })
    pdfStand.value = 'klaar'
  } catch (e) {
    pdfStand.value = 'leeg'
    toon(`De pdf maken is niet gelukt. ${foutTekst(e)}`, 'fout')
  }
}
// Delen mag alleen direct na een tik, en de pdf maken duurt even: daarom eerst maken, dan pas delen.
async function deelPdf() {
  if (!bestand.value) return
  try {
    await navigator.share({ files: [bestand.value], title: bestand.value.name })
  } catch (e) {
    if ((e as Error).name !== 'AbortError') toon('Delen lukte niet. Download de pdf en voeg hem toe aan je mail.', 'fout')
  }
}
const download = () => bestand.value && downloaden(bestand.value, bestand.value.name)

// ---------- link voor een leverancier ----------
const leverancier = ref(props.leveranciers.some(l => l.id === props.start) ? props.start! : props.leveranciers[0]?.id ?? '')
const naam = computed(() => props.leveranciers.find(l => l.id === leverancier.value)?.naam ?? '')
const actief = computed(() => actieveLink(props.links, leverancier.value, new Date()))
const vorige = computed(() => (actief.value ? null : laatsteLink(props.links, leverancier.value)))
const vorigeTekst = computed(() => {
  if (!vorige.value) return ''
  const stand = standVan(vorige.value, new Date())
  return `De vorige link: ${STAND_TEKST[stand].toLowerCase()}, ${datum(stand === 'verlopen' ? vorige.value.geldig_tot : vorige.value.gesloten_op ?? vorige.value.geldig_tot)}.`
})
const adres = computed(() => (actief.value ? linkAdres(location.origin, actief.value.token) : ''))
const bericht = computed(() => (actief.value ? deelTekst({ leverancier: naam.value, adres: adres.value, geldigTot: actief.value.geldig_tot, door: gebruiker.value?.naam ?? null }) : null))
const mail = computed(() => (bericht.value ? `mailto:?subject=${encodeURIComponent(bericht.value.onderwerp)}&body=${encodeURIComponent(bericht.value.tekst)}` : ''))
const kanDelen = typeof navigator.share === 'function'
const bezig = ref(false)

async function maakLink() {
  bezig.value = true
  try {
    emit('link', await bron.maakDeellink(leverancier.value))
    toon('Link gemaakt')
  } catch (e) {
    toon(foutTekst(e), 'fout')
  } finally {
    bezig.value = false
  }
}
async function trekIn() {
  if (!actief.value || !confirm(`De link voor ${naam.value} intrekken? De pagina gaat meteen dicht.`)) return
  bezig.value = true
  try {
    emit('link', await bron.trekDeellinkIn(actief.value.id))
    toon('Link ingetrokken')
  } catch (e) {
    toon(foutTekst(e), 'fout')
  } finally {
    bezig.value = false
  }
}
async function kopieer(tekst: string, wat: string) {
  try {
    await navigator.clipboard.writeText(tekst)
    toon(`${wat} gekopieerd`)
  } catch {
    toon('Kopiëren lukte niet. Selecteer de tekst en kopieer hem zelf.', 'fout')
  }
}
async function deelLink() {
  if (!bericht.value) return
  try {
    await navigator.share({ title: bericht.value.onderwerp, text: bericht.value.tekst })
  } catch (e) {
    if ((e as Error).name !== 'AbortError') toon('Delen lukte niet. Kopieer de link.', 'fout')
  }
}
</script>

<template>
  <dialog ref="venster" class="delen" aria-labelledby="delen-titel" @close="emit('sluit')" @click.self="sluit">
    <div class="delen-in">
      <header class="delen-kop">
        <div>
          <p class="label">Controle</p>
          <h2 id="delen-titel">Delen met extern</h2>
        </div>
        <button type="button" class="sluit-knop" aria-label="Sluiten" @click="sluit">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>
        </button>
      </header>

      <section class="delen-deel" aria-labelledby="delen-pdf">
        <h3 id="delen-pdf">Pdf van deze selectie</h3>
        <p class="klein">{{ pdf.omschrijving }}: {{ pdf.aantal }} {{ pdf.aantal === 1 ? 'punt' : 'punten' }}, met foto's en de plek op de tekening.</p>
        <div class="delen-knoppen">
          <button v-if="pdfStand !== 'klaar'" type="button" class="knop zwart" :disabled="pdfStand === 'bezig' || !pdf.aantal" @click="maakPdf">{{ pdfStand === 'bezig' ? 'Pdf maken…' : 'Pdf maken' }}</button>
          <template v-else-if="bestand">
            <button v-if="kanBestandDelen" type="button" class="knop zwart" @click="deelPdf">Pdf delen…</button>
            <button type="button" class="knop" :class="{ zwart: !kanBestandDelen }" @click="download">Downloaden</button>
            <span class="klein">{{ bestand.name }} · {{ grootte(bestand.size) }}</span>
          </template>
        </div>
        <p v-if="pdfStand === 'klaar' && !kanBestandDelen" class="klein">Deze browser kan geen bestand delen. Download de pdf en voeg hem toe aan je mail.</p>
      </section>

      <section class="delen-deel" aria-labelledby="delen-link">
        <h3 id="delen-link">Link voor een leverancier</h3>
        <p class="klein">Een eigen pagina, zonder account: alleen de open punten van deze leverancier, per project en in totaal, met de foto's en de plek op de hele tekening. Daar maakt hij zelf een pdf en vinkt hij af wat hij heeft opgelost; jullie tekenen het af of keuren het af. Een maand geldig, met een code van vijf cijfers, en dicht zodra alles is afgetekend.</p>
        <div v-if="!leveranciers.length" class="leeg-staat">Geen leverancier met open punten.</div>
        <template v-else>
          <label class="delen-veld">
            <span class="label">Leverancier</span>
            <select v-model="leverancier" class="veld">
              <option v-for="l in leveranciers" :key="l.id" :value="l.id">{{ l.naam }} ({{ l.open }} open)</option>
            </select>
          </label>

          <div v-if="actief" class="deellink">
            <p class="deellink-stand">
              <StatusTab licht="nu" woord="Actief" />
              <span class="klein">Geldig tot {{ datum(actief.geldig_tot) }} · {{ actief.bekeken_op ? `bekeken ${fmtMoment(actief.bekeken_op).toLowerCase()}` : 'nog niet bekeken' }}</span>
            </p>
            <div class="deellink-rij">
              <input class="veld mono" :value="adres" readonly aria-label="Link" @focus="($event.target as HTMLInputElement).select()">
              <button type="button" class="knop klein" @click="kopieer(adres, 'Link')">Kopiëren</button>
            </div>
            <div class="deellink-code">
              <span class="label">Code</span>
              <b class="code-cijfers n">{{ actief.code }}</b>
              <button type="button" class="knop klein" @click="kopieer(actief.code, 'Code')">Kopiëren</button>
            </div>
            <p class="klein">Stuur de code apart van de link, bijvoorbeeld per sms of telefonisch. Na tien keer een verkeerde code gaat de link dicht.</p>
            <div class="delen-knoppen">
              <button v-if="kanDelen" type="button" class="knop zwart" @click="deelLink">Link delen…</button>
              <a class="knop" :class="{ zwart: !kanDelen }" :href="mail">Mailen</a>
              <a class="knop" :href="adres" target="_blank" rel="noopener">Bekijken</a>
              <button type="button" class="link" :disabled="bezig" @click="trekIn">Intrekken</button>
            </div>
          </div>
          <div v-else class="deellink">
            <p v-if="vorigeTekst" class="klein">{{ vorigeTekst }}</p>
            <div class="delen-knoppen">
              <button type="button" class="knop zwart" :disabled="bezig || !leverancier" @click="maakLink">{{ bezig ? 'Link maken…' : 'Link maken' }}</button>
              <span class="klein">Geldig tot {{ fmt(plusMaand(new Date())) }}</span>
            </div>
          </div>
        </template>
        <p v-if="modus === 'proef'" class="melding">
          <template v-if="actief && !actief.op_server">Proefversie: deze link werkt nu alleen in deze browser, want de server kon hem (nog) niet opslaan. Open dit venster later opnieuw; dan probeert hij het nog eens.</template>
          <template v-else>Proefversie: wat de leverancier ziet, gaat als kopie uit deze browser naar de server, zodat de link ook op een ander apparaat werkt. Verander je iets, dan gaat de kopie mee.</template>
        </p>
      </section>
    </div>
  </dialog>
</template>

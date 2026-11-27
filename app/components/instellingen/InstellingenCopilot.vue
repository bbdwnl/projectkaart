<script setup lang="ts">
import { fmt, fmtMoment } from '~/lib/datum'

// Copilot koppelen (beslissing 46): Microsoft 365 Copilot (via een agent in Copilot Studio) of GitHub Copilot in VS Code
// logt met OAuth in bij de projectkaart en werkt dan namens jou, via /api/mcp. Copilot mag wat jij mag, en wat het
// wijzigt staat op jouw naam in het logboek. Een koppeling blijft werken zolang je hem gebruikt: na 30 dagen zonder gebruik, of na een jaar, vraagt Copilot opnieuw. Hier zie je je koppelingen
// en trek je ze in; koppelen zelf begint in Copilot. Het MT ziet hier ook de programma's die zich meldden (Copilot Studio,
// VS Code) en keurt ze goed of haalt ze weg: zonder goedkeuring kan niemand ze toestaan (beslissing 47).
interface Koppeling { id: string, client: string, soort: string, geldig_tot: string, laatst_gebruikt_op: string | null, aangemaakt_op: string }
interface Programma { id: string, naam: string, soort: string, adressen: string[], aangemaakt_op: string, goedgekeurd_op: string | null, goedgekeurd_door: string | null, koppelingen: number }

const metInlog = useMetInlog()
const { gebruiker } = useGebruiker()
const { toon } = useToast()
const { bevestig } = useBevestig()
const stand = ref<'laden' | 'klaar' | 'fout'>('laden')
const fout = ref('')
const koppelingen = ref<Koppeling[]>([])
const adres = computed(() => (import.meta.client ? `${window.location.origin}/api/mcp` : '/api/mcp'))

async function laad() {
  stand.value = 'laden'
  try {
    koppelingen.value = await metInlog<Koppeling[]>('/api/copilot/koppelingen')
    stand.value = 'klaar'
  } catch (e) {
    fout.value = foutTekst(e)
    stand.value = 'fout'
  }
}
onMounted(laad)

async function kopieer() {
  try {
    await navigator.clipboard.writeText(adres.value)
    toon('Adres gekopieerd')
  } catch {
    toon('Kopiëren lukte niet; selecteer het adres en kopieer het zelf.', 'fout')
  }
}

// Voor het MT: de programma's.
const programmas = ref<Programma[]>([])
const programmasStand = ref<'laden' | 'klaar' | 'fout'>('laden')
const programmasFout = ref('')
async function laadProgrammas() {
  if (!gebruiker.value?.isMt) return
  programmasStand.value = 'laden'
  try {
    programmas.value = await metInlog<Programma[]>('/api/copilot/clients')
    programmasStand.value = 'klaar'
  } catch (e) {
    programmasFout.value = foutTekst(e)
    programmasStand.value = 'fout'
  }
}
onMounted(laadProgrammas)

async function keurGoed(p: Programma) {
  if (!(await bevestig({ titel: `${p.soort} goedkeuren?`, tekst: `Daarna kan elke collega "${p.naam}" (${p.adressen.join(', ')}) toestaan en werkt het namens hem of haar. Doe dit alleen voor wat jullie zelf hebben ingesteld.`, ja: 'Goedkeuren' }))) return
  try {
    await metInlog(`/api/copilot/clients/${p.id}/goedkeuren`, { method: 'POST' })
    toon(`${p.naam} is goedgekeurd`)
    await laadProgrammas()
  } catch (e) {
    toon(foutTekst(e), 'fout')
  }
}

async function haalWeg(p: Programma) {
  const tekst = p.koppelingen
    ? `De ${p.koppelingen} ${p.koppelingen === 1 ? 'koppeling' : 'koppelingen'} van collega's met dit programma stoppen meteen. Meldt het zich opnieuw, dan vraagt de app weer om goedkeuring.`
    : 'Meldt het zich opnieuw, dan vraagt de app weer om goedkeuring.'
  if (!(await bevestig({ titel: `${p.naam} ${p.goedgekeurd_op ? 'intrekken' : 'weigeren'}?`, tekst, ja: p.goedgekeurd_op ? 'Intrekken' : 'Weigeren', gevaar: true }))) return
  try {
    await metInlog(`/api/copilot/clients/${p.id}`, { method: 'DELETE' })
    programmas.value = programmas.value.filter(x => x.id !== p.id)
    toon(`${p.naam} is weggehaald`)
  } catch (e) {
    toon(foutTekst(e), 'fout')
  }
}

async function trekIn(k: Koppeling) {
  if (!(await bevestig({ titel: `${k.soort} ontkoppelen?`, tekst: 'Copilot kan er meteen niets meer mee. Gebruik je Copilot daarna weer, dan vraagt het opnieuw om toestemming.', ja: 'Ontkoppelen', gevaar: true }))) return
  try {
    await metInlog(`/api/copilot/koppelingen/${k.id}`, { method: 'DELETE' })
    koppelingen.value = koppelingen.value.filter(x => x.id !== k.id)
    toon(`${k.soort} is ontkoppeld`)
  } catch (e) {
    toon(foutTekst(e), 'fout')
  }
}
</script>

<template>
  <section class="blok instellingen copilot">
    <div class="blokkop">
      <div>
        <h2>Copilot</h2>
        <p class="klein">
          Copilot kan de projectkaart gebruiken: projecten opzoeken, de stand geven, en taken, acties en projectgegevens bijwerken, <strong>namens jou</strong>.
          Het mag wat jij mag, en wat het wijzigt of aftekent staat op jouw naam in het logboek. De eerste keer vraagt Copilot je om in te loggen en toe te
          staan. Daarna blijft het werken zolang je Copilot gebruikt; na 30 dagen zonder gebruik, of na een jaar, vraagt het opnieuw.
        </p>
      </div>
    </div>

    <div class="kaart copilot-uitleg">
      <span class="tab">Zo koppel je</span>
      <p class="klein"><strong>Microsoft 365 Copilot:</strong> een beheerder zet de MCP-server één keer in een agent in Copilot Studio (Tools → Model Context Protocol, OAuth 2.0 met <em>Dynamic discovery</em>). Daarna vraagt Copilot iedereen bij het eerste gebruik om in te loggen.</p>
      <p class="klein"><strong>VS Code:</strong> de repo heeft <code>.vscode/mcp.json</code>; of kies MCP: Add Server → HTTP met het adres hieronder. VS Code opent dan deze app om toe te staan. Kies in de chat de modus Agent.</p>
      <div class="copilot-rij">
        <input class="veld copilot-code" :value="adres" readonly aria-label="Adres van de MCP-server" @focus="e => (e.target as HTMLInputElement).select()">
        <button type="button" class="knop" @click="kopieer">Kopieer adres</button>
      </div>
    </div>

    <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /></div>
    <div v-else-if="stand === 'fout'" class="leeg-staat">{{ fout }} <button type="button" class="link" @click="laad">Probeer het opnieuw</button></div>
    <div v-else-if="koppelingen.length" class="lijst globale-lijst copilot-lijst">
      <div class="kolkop"><span>Gekoppeld</span><span>Laatst gebruikt</span><span>Geldig tot</span><span /></div>
      <div v-for="k in koppelingen" :key="k.id" class="rij">
        <div class="rij-hoofd">
          <span>{{ k.soort }}<small class="klein copilot-naam">{{ k.client }} · sinds {{ fmtMoment(k.aangemaakt_op) }}</small></span>
          <span class="klein">{{ k.laatst_gebruikt_op ? fmtMoment(k.laatst_gebruikt_op) : 'Nog niet' }}</span>
          <span class="klein" title="Schuift op bij elk gebruik: 30 dagen na het laatste gebruik, hoogstens een jaar na het koppelen">{{ fmt(new Date(k.geldig_tot)) }}</span>
          <span class="acties"><button type="button" class="link" @click="trekIn(k)">Ontkoppelen</button></span>
        </div>
      </div>
    </div>
    <div v-else class="leeg-staat">Copilot is nog niet aan jouw account gekoppeld.</div>

    <div v-if="gebruiker?.isMt" class="kaart copilot-uitleg copilot-programmas">
      <span class="tab">Programma's die mogen koppelen</span>
      <p class="klein">
        Een programma dat zich meldt (de agent in Copilot Studio, VS Code) mag pas koppelen als iemand van het MT het goedkeurt. Zo kan niemand met een
        eigen "Copilot" een collega laten toestaan en diens toegang krijgen. Keur alleen goed wat jullie zelf hebben ingesteld; wat na een week niet is
        goedgekeurd, verdwijnt vanzelf. Intrekken stopt meteen alle koppelingen met dat programma.
      </p>
      <div v-if="programmasStand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /></div>
      <div v-else-if="programmasStand === 'fout'" class="leeg-staat">{{ programmasFout }} <button type="button" class="link" @click="laadProgrammas">Probeer het opnieuw</button></div>
      <div v-else-if="programmas.length" class="lijst globale-lijst copilot-lijst">
        <div class="kolkop"><span>Programma</span><span>Gemeld</span><span>Goedgekeurd</span><span /></div>
        <div v-for="p in programmas" :key="p.id" class="rij">
          <div class="rij-hoofd">
            <span>{{ p.soort }}<small class="klein copilot-naam">{{ p.naam }} · {{ p.adressen.join(', ') }} · {{ p.koppelingen }} {{ p.koppelingen === 1 ? 'koppeling' : 'koppelingen' }}</small></span>
            <span class="klein">{{ fmtMoment(p.aangemaakt_op) }}</span>
            <span class="klein">{{ p.goedgekeurd_op ? `${fmt(new Date(p.goedgekeurd_op))} door ${p.goedgekeurd_door}` : 'Nog niet' }}</span>
            <span class="acties copilot-acties">
              <button v-if="!p.goedgekeurd_op" type="button" class="link" @click="keurGoed(p)">Goedkeuren</button>
              <button type="button" class="link" @click="haalWeg(p)">{{ p.goedgekeurd_op ? 'Intrekken' : 'Weigeren' }}</button>
            </span>
          </div>
        </div>
      </div>
      <div v-else class="leeg-staat">Nog geen programma heeft zich gemeld.</div>
    </div>
  </section>
</template>

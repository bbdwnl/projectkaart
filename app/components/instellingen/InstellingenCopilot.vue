<script setup lang="ts">
import { fmt, fmtMoment } from '~/lib/datum'

// Copilot koppelen (beslissing 46): Microsoft 365 Copilot (via een agent in Copilot Studio) of GitHub Copilot in VS Code
// logt met OAuth in bij de projectkaart en werkt dan namens jou, via /api/mcp. Copilot mag wat jij mag, en wat het
// wijzigt staat op jouw naam in het logboek. Een koppeling geldt een week, net als een inlog. Hier zie je je koppelingen
// en trek je ze in; koppelen zelf begint in Copilot.
interface Koppeling { id: string, client: string, soort: string, geldig_tot: string, laatst_gebruikt_op: string | null, aangemaakt_op: string }

const metInlog = useMetInlog()
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
          staan; een koppeling geldt een week, net als een inlog.
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
          <span class="klein">{{ fmt(new Date(k.geldig_tot)) }}</span>
          <span class="acties"><button type="button" class="link" @click="trekIn(k)">Ontkoppelen</button></span>
        </div>
      </div>
    </div>
    <div v-else class="leeg-staat">Copilot is nog niet aan jouw account gekoppeld.</div>
  </section>
</template>

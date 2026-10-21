<script setup lang="ts">
import type { Project, Taak, Uitzondering } from '~/lib/types'
import { MENSEN } from '~/lib/fasen'
import { kansGroep, leadsVan, maakSlug, SLAGINGSKANSEN } from '~/lib/leads'
import { vandaag } from '~/lib/datum'

// Alle leads in één lijst (ProjectLijst): wie ze heeft, hoe kansrijk ze zijn en wat er nog nodig is voor de overdracht.
useHead({ title: 'Leads · Projectkaart' })
const bron = useBron()
const { modus } = useGebruiker()
const { toon } = useToast()
const nu = vandaag()
const stand = ref<'laden' | 'klaar' | 'fout'>('laden')
const fout = ref('')
const projecten = ref<Project[]>([])
const taken = ref<Taak[]>([])
const catalogus = ref<Uitzondering[]>([])

async function laad(stil = false) {
  if (!stil) stand.value = 'laden'
  try {
    ;[projecten.value, taken.value, catalogus.value] = await Promise.all([bron.projecten(), bron.taken(), bron.uitzonderingen()])
    stand.value = 'klaar'
  } catch (e) {
    if (stil) return
    fout.value = foutTekst(e)
    stand.value = 'fout'
  }
}
onMounted(() => laad())
// Live: wat een ander wijzigt, verschijnt vanzelf.
useLive(() => [{ tabel: 'projecten' }, { tabel: 'taken' }], () => laad(true))

const leads = computed(() => leadsVan(projecten.value, taken.value, catalogus.value, nu))

const zin = computed(() => {
  const n = leads.value.length
  if (!n) return 'Nog geen leads.'
  const hoog = leads.value.filter(l => kansGroep(l.p.slagingskans) === 'hoog').length
  const klaar = leads.value.filter(l => l.licht === 'klaar').length
  return `${n} ${n === 1 ? 'lead' : 'leads'}, waarvan ${hoog} met een kans van 75% of meer. ${klaar ? `${klaar} ${klaar === 1 ? 'is' : 'zijn'} klaar voor de overdracht.` : 'Nog geen enkele is klaar voor de overdracht.'}`
})

// Nieuwe lead: de minste gegevens om hem in beeld te hebben. De rest vul je op de kaart in.
const nieuwOpen = ref(false)
const bezig = ref(false)
const nieuw = reactive({ naam: '', nummer: '', am: '', kans: '' })
async function maakLead() {
  const naam = nieuw.naam.trim()
  if (naam.length < 2) return toon('Geef de lead een naam van minstens twee letters.', 'fout')
  bezig.value = true
  try {
    const p = await bron.nieuwProject({
      slug: maakSlug(naam, projecten.value.map(x => x.slug)),
      naam,
      fase: 'lead',
      nummer: nieuw.nummer.trim() || null,
      am: nieuw.am || null,
      slagingskans: nieuw.kans === '' ? null : Number(nieuw.kans),
    })
    toon(`${p.naam} staat bij de leads`)
    await navigateTo(`/projecten/${p.slug}#details`)
  } catch (e) {
    toon(foutTekst(e), 'fout')
  } finally {
    bezig.value = false
  }
}
</script>

<template>
  <main class="wrap">
    <p v-if="modus === 'proef'" class="melding">Proefversie. De leads zijn verzonnen voorbeeldgegevens. Je wijzigingen blijven alleen in deze browser.</p>
    <header class="paginakop kop-met-knop">
      <div>
        <p class="label">Kansen in beeld, nog voor de haalbaarheid</p>
        <h1>Leads</h1>
        <p v-if="stand === 'klaar'" class="zin">{{ zin }}</p>
      </div>
      <button type="button" class="knop zwart" :aria-expanded="nieuwOpen" aria-controls="nieuwe-lead" @click="nieuwOpen = !nieuwOpen">Nieuwe lead</button>
    </header>

    <Transition name="blok">
      <form v-if="nieuwOpen" id="nieuwe-lead" class="kaart nieuw-formulier" @submit.prevent="maakLead">
        <span class="tab nu">Nieuwe lead</span>
        <label><span class="label">Projectnaam</span><input v-model="nieuw.naam" class="veld" required minlength="2" placeholder="Bijvoorbeeld Gezondheidscentrum De Brink"></label>
        <label><span class="label">Projectnummer</span><input v-model="nieuw.nummer" class="veld" placeholder="Uit AFAS, als het er al is"></label>
        <label><span class="label">Accountmanager</span>
          <select v-model="nieuw.am" class="veld"><option value="">nog niet gekozen</option><option v-for="m in MENSEN.am" :key="m" :value="m">{{ m }}</option></select>
        </label>
        <label><span class="label">Slagingskans</span>
          <select v-model="nieuw.kans" class="veld"><option value="">onbekend</option><option v-for="k in SLAGINGSKANSEN" :key="k" :value="String(k)">{{ k }}%</option></select>
        </label>
        <div class="knoppen">
          <button type="submit" class="knop zwart" :disabled="bezig">{{ bezig ? 'Bezig…' : 'Opslaan' }}</button>
          <button type="button" class="link" @click="nieuwOpen = false">Annuleren</button>
        </div>
      </form>
    </Transition>

    <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /><span class="laden-regel" /></div>
    <div v-else-if="stand === 'fout'" class="leeg-staat">{{ fout }} <button type="button" class="link" @click="laad()">Probeer het opnieuw</button></div>
    <div v-else-if="!leads.length" class="leeg-staat leadfilters">Nog geen leads. Voeg er een toe met Nieuwe lead, of zet een project op de kaart op de fase Lead.</div>
    <ProjectLijst v-else fase="lead" :regels="leads" />
    <footer>Projectkaart BbDW · een lead gaat naar Haalbaarheid zodra je op de kaart de fase op Haalbaarheid zet.</footer>
  </main>
</template>

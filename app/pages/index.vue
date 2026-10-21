<script setup lang="ts">
import type { Fase, Project, Taak, Uitzondering } from '~/lib/types'
import { FASEN, faseInfo, MENSEN, ROLLEN } from '~/lib/fasen'
import { maakSlug } from '~/lib/leads'
import { kaartjesVan, KOLOMMEN, namenVan, pastPersoon, pastWie, personen, sorteerKaartjes, SORTERINGEN, vindt, type Kaartje } from '~/lib/overzicht'
import { vandaag } from '~/lib/datum'

// De lopende projecten in drie kolommen: ontwikkeling, uitvoering en nazorg. Per kolom het dringendste bovenaan.
// Daarnaast een planningsoverzicht, te filteren op fase. Leads en haalbaarheid hebben een eigen pagina.
useHead({ title: 'Projecten · Projectkaart' })
const bron = useBron()
const { modus } = useGebruiker()
const { toon } = useToast()
const nu = vandaag()
const stand = ref<'laden' | 'klaar' | 'fout'>('laden')
const fout = ref('')
const projecten = ref<Project[]>([])
const taken = ref<Taak[]>([])
const catalogus = ref<Uitzondering[]>([])
const zoek = ref('')
const { sortering, wie, pl, oz, prio } = useOverzichtKeuze('/')
const TABS = [{ id: 'kolommen', naam: 'Kolommen' }, { id: 'planning', naam: 'Planningsoverzicht' }] as const
const weergave = useTabblad<'kolommen' | 'planning'>('kolommen', ['kolommen', 'planning'])
const datumBij = (p: Project) => (sortering.value === 'inkoop' ? { naam: 'Inkoop gereed', waarde: p.datum_inkoop } : null)

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

const kaartjes = computed(() => sorteerKaartjes(kaartjesVan(projecten.value.filter(p => KOLOMMEN.includes(p.fase)), taken.value, catalogus.value, nu), sortering.value))
/** Past een kaartje door alle filters, behalve het genoemde: zo zegt het getal bij een keuze wat je krijgt. */
const past = (k: Kaartje, zonder?: 'wie' | 'pl' | 'oz' | 'prio') => vindt(k, zoek.value)
  && (zonder === 'wie' || pastWie(k, wie.value))
  && (zonder === 'pl' || pastPersoon(k.p.pm, pl.value))
  && (zonder === 'oz' || pastPersoon(k.p.opzichter, oz.value))
  && (zonder === 'prio' || !prio.value || k.p.prio)
/** Wat door de andere filters komt; daaruit tellen de knoppen van de verantwoordelijke. */
const gezocht = computed(() => kaartjes.value.filter(k => past(k, 'wie')))
const mensen = computed(() => personen(gezocht.value, wie.value))
const projectleiders = computed(() => namenVan(kaartjes.value.filter(k => past(k, 'pl')), 'pm', pl.value))
const opzichters = computed(() => namenVan(kaartjes.value.filter(k => past(k, 'oz')), 'opzichter', oz.value))
const aantalPrio = computed(() => kaartjes.value.filter(k => past(k, 'prio') && k.p.prio).length)
const gefilterd = computed(() => !!zoek.value.trim() || wie.value !== 'alle' || pl.value !== 'alle' || oz.value !== 'alle' || prio.value)
const kolommen = computed(() => KOLOMMEN.map((f) => {
  const inFase = kaartjes.value.filter(k => k.p.fase === f)
  return { fase: f, naam: faseInfo(f).naam, rol: ROLLEN[faseInfo(f).rol].kort, totaal: inFase.length, kaartjes: gezocht.value.filter(k => k.p.fase === f && pastWie(k, wie.value)) }
}))
const zin = computed(() => {
  const laat = kaartjes.value.filter(k => k.t.telaat).length
  return `${kaartjes.value.length} lopende projecten. ${laat ? `${laat} ${laat === 1 ? 'heeft' : 'hebben'} taken die te laat zijn.` : 'Niets te laat.'}`
})

// Nieuw project: begint als lead; een lopend project zet je meteen in zijn fase. De rest vul je op de kaart in.
const nieuwOpen = ref(false)
const mailOpen = ref(false)
const bezig = ref(false)
const nieuw = reactive({ naam: '', nummer: '', fase: 'lead' as Fase, wie: '' })
/** Wie in de gekozen fase verantwoordelijk is: de AM bij lead en haalbaarheid, de PO in ontwikkeling, de PM daarna. */
const nieuwRol = computed(() => faseInfo(nieuw.fase).rol)
watch(nieuwRol, (rol) => {
  if (!MENSEN[rol].includes(nieuw.wie)) nieuw.wie = ''
})
async function maakProject() {
  const naam = nieuw.naam.trim()
  if (naam.length < 2) return toon('Geef het project een naam van minstens twee letters.', 'fout')
  bezig.value = true
  try {
    const p = await bron.nieuwProject({
      slug: maakSlug(naam, projecten.value.map(x => x.slug)),
      naam,
      fase: nieuw.fase,
      nummer: nieuw.nummer.trim() || null,
      [nieuwRol.value]: nieuw.wie || null,
    })
    toon(`${p.naam} is aangemaakt`)
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
    <p v-if="modus === 'proef'" class="melding">Proefversie. De projecten en datums komen uit het prototype; statussen, mensen en documenten zijn voorbeeldgegevens. Je wijzigingen blijven alleen in deze browser.</p>
    <header class="paginakop kop-met-knop">
      <div>
        <p class="label">Ontwikkeling, uitvoering en nazorg</p>
        <h1>Projecten</h1>
        <p v-if="stand === 'klaar'" class="zin">{{ zin }}</p>
      </div>
      <div class="kop-knoppen">
        <button type="button" class="knop" :aria-expanded="mailOpen" aria-controls="mail-actiehouders" @click="mailOpen = !mailOpen">Mail actiehouders</button>
        <button type="button" class="knop zwart" :aria-expanded="nieuwOpen" aria-controls="nieuw-project" @click="nieuwOpen = !nieuwOpen">Nieuw project</button>
      </div>
    </header>

    <Transition name="blok">
      <MailActiehouders v-if="mailOpen && stand === 'klaar'" :projecten="projecten" @sluit="mailOpen = false" />
    </Transition>

    <Transition name="blok">
      <form v-if="nieuwOpen" id="nieuw-project" class="kaart nieuw-formulier" @submit.prevent="maakProject">
        <span class="tab nu">Nieuw project</span>
        <label><span class="label">Projectnaam</span><input v-model="nieuw.naam" class="veld" required minlength="2" placeholder="Bijvoorbeeld Gezondheidscentrum De Brink"></label>
        <label><span class="label">Projectnummer</span><input v-model="nieuw.nummer" class="veld" placeholder="Uit AFAS, als het er al is"></label>
        <label><span class="label">Fase</span>
          <select v-model="nieuw.fase" class="veld"><option v-for="f in FASEN" :key="f.id" :value="f.id">{{ f.naam }}</option></select>
        </label>
        <label><span class="label">{{ ROLLEN[nieuwRol].naam }}</span>
          <select v-model="nieuw.wie" class="veld"><option value="">nog niet gekozen</option><option v-for="m in MENSEN[nieuwRol]" :key="m" :value="m">{{ m }}</option></select>
        </label>
        <div class="knoppen">
          <button type="submit" class="knop zwart" :disabled="bezig">{{ bezig ? 'Bezig…' : 'Opslaan' }}</button>
          <button type="button" class="link" @click="nieuwOpen = false">Annuleren</button>
        </div>
      </form>
    </Transition>

    <PaginaTabs v-model="weergave" :tabs="[...TABS]" label="Weergave van de projecten" />
    <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /><span class="laden-regel" /></div>
    <div v-else-if="stand === 'fout'" class="leeg-staat">{{ fout }} <button type="button" class="link" @click="laad()">Probeer het opnieuw</button></div>
    <PlanningOverzicht v-else-if="weergave === 'planning'" :projecten="projecten" :lagen="['lopend']" fasefilter />
    <template v-else>
      <div class="filters projectfilters">
        <div class="filtergroep">
          <span class="label">Verantwoordelijke</span>
          <div class="seg" role="group" aria-label="Verantwoordelijke">
            <button type="button" :aria-pressed="wie === 'alle'" @click="wie = 'alle'">Iedereen <span class="n">{{ gezocht.length }}</span></button>
            <button v-for="m in mensen" :key="m.id" type="button" :aria-pressed="wie === m.id" @click="wie = m.id">{{ m.id === 'geen' ? 'Zonder' : m.id }} <span class="n">{{ m.aantal }}</span></button>
          </div>
        </div>
        <div class="filtergroep">
          <span class="label">Sorteer</span>
          <div class="seg" role="group" aria-label="Sorteer">
            <button v-for="s in SORTERINGEN" :key="s.id" type="button" :aria-pressed="sortering === s.id" @click="sortering = s.id">{{ s.naam }}</button>
          </div>
        </div>
      </div>
      <div class="filters">
        <div class="filtergroep">
          <label class="filterkeuze"><span class="label">Projectleider</span>
            <select v-model="pl" class="veld pil">
              <option value="alle">Iedereen</option>
              <option v-for="n in projectleiders" :key="n.id" :value="n.id">{{ n.id === 'geen' ? 'Nog niemand' : n.id }} ({{ n.aantal }})</option>
            </select>
          </label>
          <label class="filterkeuze"><span class="label">Opzichter</span>
            <select v-model="oz" class="veld pil">
              <option value="alle">Iedereen</option>
              <option v-for="n in opzichters" :key="n.id" :value="n.id">{{ n.id === 'geen' ? 'Nog niemand' : n.id }} ({{ n.aantal }})</option>
            </select>
          </label>
          <label class="schakel"><input v-model="prio" type="checkbox"><span />Alleen prio <small class="n">{{ aantalPrio }}</small></label>
        </div>
        <input v-model="zoek" class="veld zoekveld" type="search" placeholder="Zoek op naam, nummer, plaats of persoon" aria-label="Zoek een project">
      </div>
      <div class="kolommen">
        <section v-for="k in kolommen" :key="k.fase" class="kolom" :aria-labelledby="`kolom-${k.fase}`">
          <header class="kolom-kop">
            <h2 :id="`kolom-${k.fase}`">{{ k.naam }}</h2>
            <span class="klein n">{{ gefilterd ? `${k.kaartjes.length} van ${k.totaal}` : k.totaal }} · {{ k.rol }}</span>
          </header>
          <div class="kolom-lijst">
            <ProjectKaartje v-for="(kaartje, i) in k.kaartjes" :key="kaartje.p.id" :k="kaartje" :volgorde="i" :datum="datumBij(kaartje.p)" />
          </div>
          <p v-if="!k.kaartjes.length" class="leeg-staat klein">{{ gefilterd ? 'Niets in deze selectie.' : `Geen projecten in ${k.naam.toLowerCase()}.` }}</p>
        </section>
      </div>
    </template>
    <PlanningSignalen v-if="stand === 'klaar'" :projecten="projecten" />
    <footer>Projectkaart BbDW · het volledige overzicht met kaart en financieel komt in de volgende fase.</footer>
  </main>
</template>

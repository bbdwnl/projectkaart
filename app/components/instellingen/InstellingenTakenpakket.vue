<script setup lang="ts">
import type { Fase, Taak } from '~/lib/types'
import type { DeadlineRegel, Standaardtaak, Takengroep } from '~/lib/taken'
import { FASEN, faseInfo } from '~/lib/fasen'
import { nieuweCode, REGELTYPES, sleutelsVan } from '~/lib/instellingen'

// Het standaardpakket: per fase de groepen met taken, en per taak de deadline. Een nieuwe taak staat meteen op alle
// projecten in die fase. Een taak weghalen haalt hem van de kaarten; wat er al was ingevuld, blijft in de database
// en komt terug als de taak terugkomt (dezelfde sleutel).
const { concept, gewijzigd, bezig, isMt, opgeslagen, opslaan, standaardTerug, herstel } = useInstellingBewerken('takenpakket')
const bron = useBron()
const fase = ref<Fase>('haalbaarheid')
const taken = ref<Taak[]>([])
onMounted(async () => {
  try { taken.value = await bron.taken() } catch { /* zonder telling */ }
})
/** Hoeveel projecten iets hebben ingevuld bij deze taak: een status, eigenaar of document. */
const ingevuld = (sleutel: string) => taken.value.filter(t => t.lijst === fase.value && t.sleutel === sleutel
  && (t.status !== 'niet_gestart' || t.eigenaar || t.document_url)).length
/** Sleutels die al eens gebruikt zijn: een nieuwe taak krijgt die niet, anders komt oude invulling terug. */
const bezet = computed(() => [...new Set([...sleutelsVan(concept.value[fase.value]), ...taken.value.filter(t => t.lijst === fase.value && t.sleutel).map(t => t.sleutel!)])])
const groepen = computed(() => concept.value[fase.value])
const aantal = (f: Fase) => sleutelsVan(concept.value[f]).length
/** Een taak of groep zonder naam wordt niet bewaard. */
const zonderNaam = computed(() => Object.values(concept.value).flat().some(g => !g.titel.trim() || g.taken.some(t => !t.titel.trim())))

function nieuweTaak(g: Takengroep) {
  g.taken.push({ sleutel: nieuweCode('nieuwe taak', bezet.value, 60), titel: '' })
}
function titelTaak(t: Standaardtaak, e: Event) {
  const titel = (e.target as HTMLInputElement).value.trim()
  // Een nieuwe taak krijgt zijn sleutel uit de eerste titel; daarna blijft die vast.
  if (!t.titel && titel && t.sleutel.startsWith('nieuwe_taak')) t.sleutel = nieuweCode(titel, bezet.value.filter(s => s !== t.sleutel), 60)
  t.titel = titel
}
function wegTaak(g: Takengroep, i: number) {
  const t = g.taken[i]!
  const n = ingevuld(t.sleutel)
  if (n && !confirm(`Op ${n === 1 ? 'één project' : `${n} projecten`} is bij "${t.titel}" al iets ingevuld. Dat blijft bewaard, maar is niet meer te zien. Weghalen?`)) return
  g.taken.splice(i, 1)
}
function schuif<T>(lijst: T[], i: number, d: -1 | 1) {
  const [x] = lijst.splice(i, 1)
  lijst.splice(i + d, 0, x!)
}
/** Een taak naar de vorige of volgende groep. */
function naarGroep(gi: number, ti: number, d: -1 | 1) {
  const [t] = groepen.value[gi]!.taken.splice(ti, 1)
  groepen.value[gi + d]!.taken[d === 1 ? 'unshift' : 'push'](t!)
}
function nieuweGroep() {
  groepen.value.push({ titel: 'Nieuwe groep', taken: [] })
}
function wegGroep(i: number) {
  const g = groepen.value[i]!
  if (g.taken.length && !confirm(`De groep "${g.titel}" met ${g.taken.length} taken weghalen?`)) return
  groepen.value.splice(i, 1)
}

// De deadline: geen, of een aantal dagen (bij inkoop weken) vóór of na een projectdatum.
const regelType = (t: Standaardtaak) => t.regel?.type ?? ''
const regelGetal = (t: Standaardtaak) => (t.regel ? (t.regel.type === 'inkoop' ? t.regel.weken : t.regel.dagen) : 0)
function zetRegel(t: Standaardtaak, type: string, getal = regelGetal(t), casco = t.regel?.type === 'inkoop' && !!t.regel.casco) {
  const n = Math.max(0, Math.min(type === 'inkoop' ? 104 : 730, Math.round(Number(getal) || 0)))
  const r: DeadlineRegel | undefined = type === 'inkoop' ? { type: 'inkoop', weken: n, ...(casco ? { casco: true } : {}) }
    : type === 'voorbereiding' || type === 'afbouw' || type === 'oplevering' ? { type, dagen: n } : undefined
  if (r) t.regel = r
  else delete t.regel
}
const eenheid = (t: Standaardtaak) => REGELTYPES.find(r => r.type === t.regel?.type)?.eenheid ?? 'dagen'
</script>

<template>
  <section class="blok instellingen">
    <div class="blokkop">
      <div>
        <h2>Takenpakket</h2>
        <p class="klein">De standaardtaken per fase, in groepen, met hun deadline. Een wijziging geldt meteen voor alle projecten. Haal je een taak weg, dan blijft wat er al was ingevuld bewaard.</p>
      </div>
      <div class="seg" role="group" aria-label="Fase">
        <button v-for="f in FASEN" :key="f.id" type="button" :aria-pressed="fase === f.id" @click="fase = f.id">{{ f.naam }} <span class="n">{{ aantal(f.id) }}</span></button>
      </div>
    </div>
    <fieldset class="kaal inst-pakket" :disabled="!isMt">
      <div v-for="(g, gi) in groepen" :key="gi" class="kaart inst-groep">
        <div class="inst-groepkop">
          <label><span class="label">Groep</span><input v-model.trim="g.titel" class="veld" maxlength="120" aria-label="Naam van de groep"></label>
          <label><span class="label">Uitleg</span><input :value="g.uitleg ?? ''" class="veld" maxlength="200" placeholder="Bijvoorbeeld: compleet 2 weken vóór start voorbereiding" aria-label="Uitleg bij de groep" @change="e => { const v = (e.target as HTMLInputElement).value.trim(); if (v) g.uitleg = v; else delete g.uitleg }"></label>
          <span class="inst-knopjes">
            <button type="button" class="ikoon" :disabled="gi === 0" title="Groep omhoog" aria-label="Groep omhoog" @click="schuif(groepen, gi, -1)">↑</button>
            <button type="button" class="ikoon" :disabled="gi === groepen.length - 1" title="Groep omlaag" aria-label="Groep omlaag" @click="schuif(groepen, gi, 1)">↓</button>
            <button type="button" class="ikoon" title="Groep weghalen" aria-label="Groep weghalen" @click="wegGroep(gi)">✕</button>
          </span>
        </div>
        <ol class="inst-taken">
          <li v-for="(t, ti) in g.taken" :key="t.sleutel" class="inst-taak">
            <input class="veld" :value="t.titel" placeholder="Wat moet er klaar zijn?" maxlength="200" :aria-label="`Taak ${ti + 1}`" @change="e => titelTaak(t, e)">
            <span class="inst-regel">
              <select class="veld" :value="regelType(t)" :aria-label="`Deadline van ${t.titel || 'de taak'}`" @change="e => zetRegel(t, (e.target as HTMLSelectElement).value)">
                <option value="">Geen deadline</option>
                <option v-for="r in REGELTYPES" :key="r.type" :value="r.type">{{ r.eenheid }} {{ r.naam }}</option>
              </select>
              <template v-if="t.regel">
                <input class="veld getal n" type="number" min="0" :max="t.regel.type === 'inkoop' ? 104 : 730" :value="regelGetal(t)" :aria-label="`Aantal ${eenheid(t)}`" @change="e => zetRegel(t, t.regel!.type, Number((e.target as HTMLInputElement).value))">
                <span class="klein">{{ eenheid(t) }}</span>
                <label v-if="t.regel.type === 'inkoop'" class="klein inst-casco" title="Valt start casco tussen voorbereiding en inkoop, dan telt hij vanaf start casco"><input type="checkbox" :checked="!!t.regel.casco" @change="e => zetRegel(t, 'inkoop', regelGetal(t), (e.target as HTMLInputElement).checked)"> casco eerder</label>
              </template>
            </span>
            <span class="inst-knopjes">
              <small v-if="ingevuld(t.sleutel)" class="klein n" :title="`Op ${ingevuld(t.sleutel)} projecten ingevuld`">{{ ingevuld(t.sleutel) }}×</small>
              <button type="button" class="ikoon" :disabled="ti === 0 && gi === 0" title="Omhoog" :aria-label="`${t.titel} omhoog`" @click="ti === 0 ? naarGroep(gi, ti, -1) : schuif(g.taken, ti, -1)">↑</button>
              <button type="button" class="ikoon" :disabled="ti === g.taken.length - 1 && gi === groepen.length - 1" title="Omlaag" :aria-label="`${t.titel} omlaag`" @click="ti === g.taken.length - 1 ? naarGroep(gi, ti, 1) : schuif(g.taken, ti, 1)">↓</button>
              <button type="button" class="ikoon" title="Weghalen" :aria-label="`${t.titel} weghalen`" @click="wegTaak(g, ti)">✕</button>
            </span>
          </li>
        </ol>
        <button type="button" class="knop klein" @click="nieuweTaak(g)">+ Taak</button>
      </div>
      <p v-if="!groepen.length" class="leeg-staat">{{ faseInfo(fase).naam }} heeft geen standaardtaken.</p>
      <button type="button" class="knop" @click="nieuweGroep">+ Groep in {{ faseInfo(fase).naam.toLowerCase() }}</button>
    </fieldset>
    <p v-if="zonderNaam && gewijzigd" class="fout-melding">Er is een taak of groep zonder naam; die wordt bij opslaan niet bewaard.</p>
    <InstellingenOpslaan :gewijzigd="gewijzigd" :bezig="bezig" :is-mt="isMt" :opgeslagen="opgeslagen" @opslaan="opslaan" @herstel="herstel" @standaard="standaardTerug" />
  </section>
</template>

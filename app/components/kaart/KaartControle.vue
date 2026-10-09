<script setup lang="ts">
import type { Controlepunt } from '~/lib/types'
import { pastPunt, sorteerPunten, type ControleFilter } from '~/lib/controle'
import { pinsVan, type BladPlek } from '~/lib/tekening'
import { fmtMoment } from '~/lib/datum'

// Aandachtspunten: wat opvalt op de bouw of bij de oplevering. Elk punt heeft een foto en een notitie;
// de leverancier die het oplost kies je meteen of later in de lijst.
const { controlepunten, leveranciers, nu, openPunten, zetOpgelost, kiesLeverancier, verwijderControlepunt, tekeningen, nummers, zetPlek } = useKaart()
const bron = useBron()
const filter = ref<ControleFilter>('open')
const leverancier = ref('alle')
const nieuwOpen = ref(false)
const fotos = ref<Record<string, string>>({})
const groot = ref<Controlepunt | null>(null)
const venster = ref<HTMLDialogElement>()

// Adressen van de foto's (bij Supabase een uur geldig). Bij een fout blijft de notitie gewoon leesbaar.
async function haalFotos(paden: string[]) {
  if (!paden.length) return
  try {
    fotos.value = { ...fotos.value, ...await bron.fotoUrls(paden) }
  } catch { /* zonder foto */ }
}
watch(() => controlepunten.value.map(p => p.foto), paden => haalFotos(paden.filter(p => !fotos.value[p])), { immediate: true })
const verlopen = new Set<string>()
function fotoFout(pad: string) {
  if (verlopen.has(pad)) return
  verlopen.add(pad)
  haalFotos([pad])
}

const naam = (id: string | null) => !id || id === 'geen' ? 'Geen leverancier' : leveranciers.value.find(l => l.id === id)?.naam ?? 'Onbekende leverancier'
const zonderLeverancier = computed(() => controlepunten.value.some(p => !p.leverancier_id))
const selectieTekst = computed(() => leverancier.value === 'alle' ? '' : leverancier.value === 'geen' ? ' zonder leverancier' : ` voor ${naam(leverancier.value)}`)
const kies = (p: Controlepunt, e: Event) => kiesLeverancier(p, (e.target as HTMLSelectElement).value || null)
const zichtbaar = computed(() => sorteerPunten(controlepunten.value.filter(p => pastPunt(p, filter.value, leverancier.value))))
const aantal = (f: ControleFilter) => controlepunten.value.filter(p => pastPunt(p, f, leverancier.value)).length
const kop = computed(() => !controlepunten.value.length
  ? 'Nog geen aandachtspunten'
  : openPunten.value ? `${openPunten.value} ${openPunten.value === 1 ? 'aandachtspunt staat' : 'aandachtspunten staan'} open` : 'Alle aandachtspunten zijn opgelost')

function toonFoto(p: Controlepunt) {
  groot.value = p
  nextTick(() => venster.value?.showModal())
}
// De tekening: alle punten als pins, of één punt (bekijken, verplaatsen, of een plek kiezen).
const pins = computed(() => pinsVan(controlepunten.value, p => nummers.value.get(p.id) ?? '?', p => naam(p.leverancier_id)))
const viewer = ref<{ tekeningId: string, punt: Controlepunt | null, markeren: boolean, titel: string } | null>(null)
const plekVan = (p: Controlepunt | null) => p?.tekening_id ? { tekening_id: p.tekening_id, blad: p.tekening_blad!, x: p.tekening_x!, y: p.tekening_y! } : null
/** De tekening met de meeste open punten eerst. */
const eersteTekening = computed(() => [...tekeningen.value]
  .sort((a, b) => pins.value.filter(p => p.tekening_id === b.id && !p.opgelost).length - pins.value.filter(p => p.tekening_id === a.id && !p.opgelost).length)[0])
function overTekening() {
  if (eersteTekening.value) viewer.value = { tekeningId: eersteTekening.value.id, punt: null, markeren: false, titel: 'Aandachtspunten op de tekening' }
}
function opTekening(p: Controlepunt) {
  const id = p.tekening_id ?? eersteTekening.value?.id
  if (id) viewer.value = { tekeningId: id, punt: p, markeren: !p.tekening_id, titel: `#${nummers.value.get(p.id)} · ${p.notitie}` }
}
function plekGekozen(plek: BladPlek & { tekening_id: string }) {
  const p = viewer.value?.punt
  if (p) zetPlek(p, { tekening_id: plek.tekening_id, tekening_blad: plek.blad, tekening_x: plek.x, tekening_y: plek.y })
}

async function weg(p: Controlepunt) {
  if (confirm('Dit aandachtspunt weghalen? De foto gaat ook weg.')) await verwijderControlepunt(p)
}
</script>

<template>
  <div id="paneel-controle" class="paneel" role="tabpanel" aria-labelledby="tab-controle">
    <section class="blok controle">
      <div class="blokkop">
        <div>
          <h2>{{ kop }}</h2>
          <p class="klein">Zie je op de bouw of bij de oplevering iets wat niet klopt? Maak een foto, schrijf erbij wat er mis is en kies, als je het weet, de leverancier die het oplost.</p>
        </div>
        <div class="controle-knoppen">
          <button v-if="tekeningen.length" type="button" class="knop" @click="overTekening">Op tekening</button>
          <button type="button" class="knop zwart" :aria-expanded="nieuwOpen" aria-controls="controle-nieuw" @click="nieuwOpen = !nieuwOpen">Aandachtspunt toevoegen</button>
        </div>
      </div>

      <Transition name="blok">
        <ControleNieuw v-if="nieuwOpen" id="controle-nieuw" @klaar="nieuwOpen = false" />
      </Transition>

      <template v-if="controlepunten.length">
        <div class="filters">
          <div class="seg" role="group" aria-label="Welke aandachtspunten">
            <button type="button" :aria-pressed="filter === 'open'" @click="filter = 'open'">Open <span class="n">{{ aantal('open') }}</span></button>
            <button type="button" :aria-pressed="filter === 'opgelost'" @click="filter = 'opgelost'">Opgelost <span class="n">{{ aantal('opgelost') }}</span></button>
            <button type="button" :aria-pressed="filter === 'alles'" @click="filter = 'alles'">Alles <span class="n">{{ aantal('alles') }}</span></button>
          </div>
          <select v-model="leverancier" class="veld pil" aria-label="Leverancier">
            <option value="alle">Alle leveranciers</option>
            <option v-for="l in leveranciers" :key="l.id" :value="l.id">{{ l.naam }}</option>
            <option v-if="zonderLeverancier || leverancier === 'geen'" value="geen">Zonder leverancier</option>
          </select>
        </div>
        <TransitionGroup v-if="zichtbaar.length" tag="ol" name="rij" class="lijst controlelijst">
          <li v-for="p in zichtbaar" :key="p.id" class="rij">
            <div class="rij-hoofd">
              <button type="button" class="duim" :aria-label="`Foto bekijken: ${p.notitie}`" @click="toonFoto(p)">
                <img v-if="fotos[p.foto]" :src="fotos[p.foto]" alt="" loading="lazy" @error="fotoFout(p.foto)">
              </button>
              <div class="titel">
                <span class="notitie"><b class="punt-nr">#{{ nummers.get(p.id) }}</b> {{ p.notitie }}</span>
                <small>
                  <select v-if="leveranciers.length" class="leverancier-kies" :class="{ leeg: !p.leverancier_id }" :value="p.leverancier_id ?? ''" :aria-label="`Leverancier bij: ${p.notitie}`" @change="kies(p, $event)">
                    <option value="">Geen leverancier</option>
                    <option v-for="l in leveranciers" :key="l.id" :value="l.id">{{ l.naam }}</option>
                  </select>
                  <template v-else>Geen leverancier</template>
                  · {{ p.aangemaakt_door ?? 'Onbekend' }} · {{ fmtMoment(p.aangemaakt_op, nu) }}
                </small>
                <small v-if="p.opgelost && p.opgelost_op">Opgelost door {{ p.opgelost_door ?? 'onbekend' }} · {{ fmtMoment(p.opgelost_op, nu) }}</small>
              </div>
              <span><StatusTab :licht="p.opgelost ? 'klaar' : 'letop'" :woord="p.opgelost ? 'Opgelost' : 'Open'" /></span>
              <span class="acties">
                <button v-if="!p.opgelost" type="button" class="knop klein" @click="zetOpgelost(p, true)">Opgelost</button>
                <button v-else type="button" class="link" @click="zetOpgelost(p, false)">Weer open</button>
                <button v-if="p.tekening_id || tekeningen.length" type="button" class="plek-knop" :class="{ heeft: p.tekening_id }" :title="p.tekening_id ? 'Op de tekening bekijken' : 'Plek op de tekening kiezen'" :aria-label="p.tekening_id ? `#${nummers.get(p.id)} op de tekening bekijken` : `Plek op de tekening kiezen voor #${nummers.get(p.id)}`" @click="opTekening(p)">
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 15s5-4.6 5-8.5A5 5 0 0 0 3 6.5C3 10.4 8 15 8 15z" fill="none" stroke="currentColor" stroke-width="1.7" /><circle cx="8" cy="6.5" r="1.8" fill="currentColor" /></svg>
                </button>
                <button type="button" class="link" @click="weg(p)">Weghalen</button>
              </span>
            </div>
          </li>
        </TransitionGroup>
        <div v-else class="leeg-staat">{{ filter === 'open' ? 'Niets open' : 'Niets' }}{{ selectieTekst }}.</div>
      </template>
      <div v-else-if="!nieuwOpen" class="leeg-staat">Hier komen de aandachtspunten van dit project, met de foto erbij. Begin met Aandachtspunt toevoegen.</div>
    </section>

    <TekeningViewer
      v-if="viewer" :tekeningen="tekeningen" :tekening-id="viewer.tekeningId" :pins="pins" :markeren="viewer.markeren"
      :kan-verplaatsen="!!viewer.punt" :plek="plekVan(viewer.punt)" :actief="viewer.punt?.id ?? null" :titel="viewer.titel"
      @kies="plekGekozen" @sluit="viewer = null"
    />

    <dialog ref="venster" class="fotovenster" @close="groot = null" @click.self="venster?.close()">
      <figure v-if="groot">
        <img v-if="fotos[groot.foto]" :src="fotos[groot.foto]" :alt="groot.notitie">
        <figcaption><span class="notitie">{{ groot.notitie }}</span><small>{{ naam(groot.leverancier_id) }} · {{ fmtMoment(groot.aangemaakt_op, nu) }}</small></figcaption>
      </figure>
      <button type="button" class="knop klein" @click="venster?.close()">Sluiten</button>
    </dialog>
  </div>
</template>

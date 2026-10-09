<script setup lang="ts">
import type { Controlepunt } from '~/lib/types'
import { pastPunt, sorteerPunten, type ControleFilter } from '~/lib/controle'
import { fmtMoment } from '~/lib/datum'

// Aandachtspunten: wat opvalt op de bouw of bij de oplevering. Elk punt heeft een foto, een notitie en een leverancier.
const { controlepunten, leveranciers, nu, openPunten, zetOpgelost, verwijderControlepunt } = useKaart()
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

const naam = (id: string) => leveranciers.value.find(l => l.id === id)?.naam ?? 'Onbekende leverancier'
const zichtbaar = computed(() => sorteerPunten(controlepunten.value.filter(p => pastPunt(p, filter.value, leverancier.value))))
const aantal = (f: ControleFilter) => controlepunten.value.filter(p => pastPunt(p, f, leverancier.value)).length
const kop = computed(() => !controlepunten.value.length
  ? 'Nog geen aandachtspunten'
  : openPunten.value ? `${openPunten.value} ${openPunten.value === 1 ? 'aandachtspunt staat' : 'aandachtspunten staan'} open` : 'Alle aandachtspunten zijn opgelost')

function toonFoto(p: Controlepunt) {
  groot.value = p
  nextTick(() => venster.value?.showModal())
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
          <p class="klein">Zie je op de bouw of bij de oplevering iets wat niet klopt? Maak een foto, schrijf erbij wat er mis is en kies de leverancier die het oplost.</p>
        </div>
        <button type="button" class="knop zwart" :aria-expanded="nieuwOpen" aria-controls="controle-nieuw" @click="nieuwOpen = !nieuwOpen">Aandachtspunt toevoegen</button>
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
          </select>
        </div>
        <TransitionGroup v-if="zichtbaar.length" tag="ol" name="rij" class="lijst controlelijst">
          <li v-for="p in zichtbaar" :key="p.id" class="rij">
            <div class="rij-hoofd">
              <button type="button" class="duim" :aria-label="`Foto bekijken: ${p.notitie}`" @click="toonFoto(p)">
                <img v-if="fotos[p.foto]" :src="fotos[p.foto]" alt="" loading="lazy" @error="fotoFout(p.foto)">
              </button>
              <div class="titel">
                <span class="notitie">{{ p.notitie }}</span>
                <small><b>{{ naam(p.leverancier_id) }}</b> · {{ p.aangemaakt_door ?? 'Onbekend' }} · {{ fmtMoment(p.aangemaakt_op, nu) }}</small>
                <small v-if="p.opgelost && p.opgelost_op">Opgelost door {{ p.opgelost_door ?? 'onbekend' }} · {{ fmtMoment(p.opgelost_op, nu) }}</small>
              </div>
              <span><StatusTab :licht="p.opgelost ? 'klaar' : 'letop'" :woord="p.opgelost ? 'Opgelost' : 'Open'" /></span>
              <span class="acties">
                <button v-if="!p.opgelost" type="button" class="knop klein" @click="zetOpgelost(p, true)">Opgelost</button>
                <button v-else type="button" class="link" @click="zetOpgelost(p, false)">Weer open</button>
                <button type="button" class="link" @click="weg(p)">Weghalen</button>
              </span>
            </div>
          </li>
        </TransitionGroup>
        <div v-else class="leeg-staat">{{ filter === 'open' ? 'Niets open' : 'Niets' }}{{ leverancier !== 'alle' ? ` voor ${naam(leverancier)}` : '' }}.</div>
      </template>
      <div v-else-if="!nieuwOpen" class="leeg-staat">Hier komen de aandachtspunten van dit project, met de foto erbij. Begin met Aandachtspunt toevoegen.</div>
    </section>

    <dialog ref="venster" class="fotovenster" @close="groot = null" @click.self="venster?.close()">
      <figure v-if="groot">
        <img v-if="fotos[groot.foto]" :src="fotos[groot.foto]" :alt="groot.notitie">
        <figcaption><span class="notitie">{{ groot.notitie }}</span><small>{{ naam(groot.leverancier_id) }} · {{ fmtMoment(groot.aangemaakt_op, nu) }}</small></figcaption>
      </figure>
      <button type="button" class="knop klein" @click="venster?.close()">Sluiten</button>
    </dialog>
  </div>
</template>

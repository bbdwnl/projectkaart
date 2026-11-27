<script setup lang="ts">
import { perDag, tijdVan } from '~/lib/fotodossier'
import { fmtMoment } from '~/lib/datum'

// Fotodossier (beslissing 50): hoe iets eruitzag, per dag. Zoals Controle, maar alleen een foto en een optionele titel.
const emit = defineEmits<{ foto: [bestand: File] }>()
const { dossierfotos, nu, wijzigDossiertitel, verwijderDossierfoto } = useKaart()
const bron = useBron()
const { bevestig } = useBevestig()
const urls = ref<Record<string, string>>({})
const dagen = computed(() => perDag(dossierfotos.value, nu))

// Adressen van de foto's (een uur geldig). Verloopt er een, dan opnieuw ophalen.
async function haalFotos(paden: string[]) {
  if (!paden.length) return
  try {
    urls.value = { ...urls.value, ...await bron.dossierfotoUrls(paden) }
  } catch { /* zonder foto; de titel blijft leesbaar */ }
}
watch(() => dossierfotos.value.map(f => f.foto), paden => haalFotos(paden.filter(p => !urls.value[p])), { immediate: true })
const verlopen = new Set<string>()
function fotoFout(pad: string) {
  if (verlopen.has(pad)) return
  verlopen.add(pad)
  haalFotos([pad])
}

// Groot bekijken, met de titel om te wijzigen. Via het id, zodat het venster meeloopt met live wijzigingen.
const grootId = ref<string | null>(null)
const groot = computed(() => dossierfotos.value.find(f => f.id === grootId.value) ?? null)
const titel = ref('')
const titelVeld = ref<HTMLInputElement>()
const venster = ref<HTMLDialogElement>()
/** Wat er als laatste is verstuurd: Enter, wegklikken en sluiten slaan zo samen één keer op. */
let verstuurd: string | null | undefined
function toonFoto(id: string) {
  grootId.value = id
  titel.value = groot.value?.titel ?? ''
  verstuurd = undefined
  nextTick(() => venster.value?.showModal())
}
function bewaarTitel() {
  const f = groot.value
  const nieuw = titel.value.trim() || null
  if (!f || nieuw === (verstuurd === undefined ? f.titel : verstuurd)) return
  verstuurd = nieuw
  wijzigDossiertitel(f, nieuw ?? '')
}
function sluit() {
  bewaarTitel()
  grootId.value = null
}
async function weg() {
  const f = groot.value
  if (!f) return
  venster.value?.close()
  if (await bevestig({ titel: 'Foto weghalen?', tekst: 'De foto gaat uit het fotodossier van dit project.', ja: 'Weghalen', gevaar: true })) await verwijderDossierfoto(f)
}

const kop = computed(() => {
  const n = dossierfotos.value.length
  return n ? `${n} ${n === 1 ? 'foto' : "foto's"} in het fotodossier` : 'Nog geen foto\'s'
})
</script>

<template>
  <div id="paneel-fotodossier" class="paneel" role="tabpanel" aria-labelledby="tab-fotodossier">
    <section class="blok fotodossier">
      <div class="blokkop">
        <div>
          <h2>{{ kop }}</h2>
          <p class="klein">Leg vast hoe het eruitzag: leidingen voor het dichtmaken, de bouwplaats, de oplevering. Een titel is niet verplicht.</p>
        </div>
        <FotodossierKnop class="knop zwart" @gekozen="b => emit('foto', b)">Foto toevoegen</FotodossierKnop>
      </div>

      <template v-if="dagen.length">
        <section v-for="d in dagen" :key="d.dag" class="dossier-dag">
          <h3 class="label">{{ d.dag }}</h3>
          <TransitionGroup tag="ul" name="rij" class="dossier-raster">
            <li v-for="f in d.fotos" :key="f.id">
              <button type="button" class="dossier-foto" :aria-label="`Foto bekijken: ${f.titel ?? 'zonder titel'}`" @click="toonFoto(f.id)">
                <span class="dossier-duim"><img v-if="urls[f.foto]" :src="urls[f.foto]" alt="" loading="lazy" @error="fotoFout(f.foto)"></span>
                <span class="dossier-onderschrift">
                  <span class="dossier-titeltekst" :class="{ leeg: !f.titel }">{{ f.titel ?? 'Zonder titel' }}</span>
                  <small>{{ f.aangemaakt_door ?? 'Onbekend' }} · {{ tijdVan(f.aangemaakt_op) }}</small>
                </span>
              </button>
            </li>
          </TransitionGroup>
        </section>
      </template>
      <div v-else class="leeg-staat">Hier komen de foto's van dit project. Begin met Foto toevoegen; op de telefoon kan dat ook met de cameraknop rechtsonder.</div>
    </section>

    <dialog ref="venster" class="fotovenster" @close="sluit" @click.self="venster?.close()">
      <figure v-if="groot">
        <img v-if="urls[groot.foto]" :src="urls[groot.foto]" :alt="groot.titel ?? 'Foto uit het fotodossier'">
        <figcaption><small>{{ groot.aangemaakt_door ?? 'Onbekend' }} · {{ fmtMoment(groot.aangemaakt_op, nu) }}</small></figcaption>
      </figure>
      <form v-if="groot" class="dossier-bewerk" @submit.prevent="titelVeld?.blur()">
        <label class="dossier-titel"><span class="label">Titel (optioneel)</span>
          <input ref="titelVeld" v-model="titel" class="veld" maxlength="200" enterkeyhint="done" placeholder="Zonder titel" @change="bewaarTitel">
        </label>
        <div class="knoppen">
          <button type="button" class="knop klein" @click="venster?.close()">Sluiten</button>
          <button type="button" class="link" @click="weg">Weghalen</button>
        </div>
      </form>
    </dialog>
  </div>
</template>

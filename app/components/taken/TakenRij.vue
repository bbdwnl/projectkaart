<script setup lang="ts">
import type { TaakRegel } from '~/lib/stoplicht'
import type { Status, TaakWijziging } from '~/lib/types'
import { EIGENAREN } from '~/lib/fasen'
import { naamUitLink, STATUSSEN } from '~/lib/taak'
import { fmt, fmtMoment, naarDatum } from '~/lib/datum'
import { isKandidaat } from '~/lib/uitzonderingen'

// Eén taak op één regel, zonder uitklap: het document koppel je in de regel zelf,
// de opmerkingen (en reden n.v.t., aanleiding, spoor) staan achter het icoon.
const props = defineProps<{ regel: TaakRegel }>()
const emit = defineEmits<{ wijzig: [w: TaakWijziging], verwijder: [] }>()
const { gebruik, bereikt, nadruk, nu, opmerkingenVan, plaatsOpmerking } = useKaart()
const { toon } = useToast()

const gloed = ref(false)
const rij = ref<HTMLElement>()

const t = computed(() => props.regel.taak)
const eigenaren = computed(() => t.value?.eigenaar && !EIGENAREN.includes(t.value.eigenaar) ? [...EIGENAREN, t.value.eigenaar] : EIGENAREN)
const kandidaat = computed(() => {
  const u = props.regel.uitzondering
  return !!u && u.status !== 'standaard' && isKandidaat(gebruik.value.get(u.id) ?? 0, bereikt(u.fase))
})
const urgent = computed(() => props.regel.b.licht === 'telaat' || props.regel.b.licht === 'letop')
const bestand = computed(() => t.value?.document_url || t.value?.document_naam ? { url: t.value.document_url, naam: t.value.document_naam || naamUitLink(t.value.document_url!) } : null)
const definitiefTekst = computed(() => t.value?.afgetekend_door ? `Op Definitief gezet door ${t.value.afgetekend_door} op ${fmt(naarDatum(t.value.afgetekend_op))}` : 'Nog niet definitief')
const lijst = computed(() => opmerkingenVan(t.value?.id))
const knopTekst = computed(() => {
  const n = lijst.value.length
  return n ? `${n} ${n === 1 ? 'opmerking' : 'opmerkingen'}, de laatste van ${lijst.value[n - 1]!.door}` : 'Opmerking plaatsen'
})
const akkoordTekst = computed(() => t.value?.klantakkoord_door ? `Klantakkoord vastgelegd door ${t.value.klantakkoord_door} op ${fmt(naarDatum(t.value.klantakkoord_op))}` : 'Klantakkoord')

const tekst = (e: Event) => (e.target as HTMLInputElement | HTMLTextAreaElement).value.trim() || null

// ---------- document: direct in de regel ----------
const docBewerken = ref(false)
const docVeld = ref<HTMLInputElement>()
async function bewerkDocument() {
  docBewerken.value = true
  await nextTick()
  docVeld.value?.focus()
  docVeld.value?.select()
}
/** Enter of klik ernaast bewaart, Escape laat alles zoals het was. Leeg = document weghalen. */
function bewaarDocument(e: Event) {
  if (!docBewerken.value) return
  const waarde = (e.target as HTMLInputElement).value.trim()
  if (waarde && !/^https?:\/\//i.test(waarde)) {
    toon('Plak een link die begint met https://, bijvoorbeeld uit SharePoint.', 'fout')
    if (e.type === 'keydown') return
  } else if (waarde !== (t.value?.document_url ?? '')) {
    emit('wijzig', waarde ? { document_url: waarde, document_naam: naamUitLink(waarde) } : { document_url: null, document_naam: null })
  }
  docBewerken.value = false
}

// ---------- opmerkingen: een venster bij het icoon ----------
const notitieOpen = ref(false)
const notitieKnop = ref<HTMLElement>()
const paneel = ref<HTMLElement>()
const lijstEl = ref<HTMLElement>()
const opmerkingVeld = ref<HTMLTextAreaElement>()
const redenVeld = ref<HTMLInputElement>()
const aanleidingVeld = ref<HTMLInputElement>()
/** Wat je typt maar nog niet plaatste; blijft staan als plaatsen mislukt. */
const concept = ref('')
const plaatsBezig = ref(false)
/** Onder het icoon, of erboven als daar geen ruimte is. Op mobiel een paneel onderaan (CSS). */
const plek = ref<Record<string, string>>({})
const PANEEL_HOOGTE = 560
function plaats() {
  const r = notitieKnop.value?.getBoundingClientRect()
  if (!r) return
  const onder = r.bottom + PANEEL_HOOGTE < innerHeight || r.top < PANEEL_HOOGTE
  plek.value = { right: `${Math.max(16, innerWidth - r.right)}px`, ...(onder ? { top: `${r.bottom + 6}px` } : { bottom: `${innerHeight - r.top + 6}px` }) }
}
/** De nieuwste opmerking staat onderaan, net boven het veld. */
const naarNieuwste = () => lijstEl.value?.scrollTo({ top: lijstEl.value.scrollHeight })

async function openNotitie(focus: 'opmerking' | 'reden' = 'opmerking') {
  plaats()
  notitieOpen.value = true
  await nextTick()
  naarNieuwste()
  ;(focus === 'reden' ? redenVeld.value : opmerkingVeld.value)?.focus()
}
async function plaatsConcept() {
  if (!concept.value.trim() || plaatsBezig.value) return
  plaatsBezig.value = true
  const gelukt = await plaatsOpmerking(props.regel, concept.value)
  plaatsBezig.value = false
  if (!gelukt) return
  concept.value = ''
  await nextTick()
  naarNieuwste()
}
/** Alles in het venster in één keer bewaren, ook bij Escape, ernaast klikken of weggaan; een getypte opmerking wordt geplaatst. */
function bewaarVenster() {
  const w: TaakWijziging = {}
  const waarde = (veld?: HTMLInputElement | HTMLTextAreaElement) => veld ? veld.value.trim() || null : undefined
  const reden = waarde(redenVeld.value)
  const aanleiding = waarde(aanleidingVeld.value)
  plaatsConcept()
  if (reden !== undefined && reden !== (t.value?.reden_nvt ?? null)) w.reden_nvt = reden
  if (aanleiding !== undefined && aanleiding !== (t.value?.aanleiding ?? null)) w.aanleiding = aanleiding
  if (Object.keys(w).length) emit('wijzig', w)
}
function sluitNotitie() {
  if (!notitieOpen.value) return
  bewaarVenster()
  notitieOpen.value = false
}
const volg = () => notitieOpen.value && plaats()
function buiten(e: MouseEvent) {
  const doel = e.target as Node
  if (notitieOpen.value && !paneel.value?.contains(doel) && !notitieKnop.value?.contains(doel)) sluitNotitie()
}
function toets(e: KeyboardEvent) {
  if (e.key === 'Escape' && notitieOpen.value) {
    sluitNotitie()
    notitieKnop.value?.focus()
  }
}
onMounted(() => {
  document.addEventListener('mousedown', buiten)
  document.addEventListener('keydown', toets)
  addEventListener('scroll', volg, { passive: true })
  addEventListener('resize', volg)
})
onBeforeUnmount(() => {
  sluitNotitie()
  document.removeEventListener('mousedown', buiten)
  document.removeEventListener('keydown', toets)
  removeEventListener('scroll', volg)
  removeEventListener('resize', volg)
})

function kiesStatus(e: Event) {
  const status = (e.target as HTMLSelectElement).value as Status
  emit('wijzig', { status })
  if (status === 'nvt' && !t.value?.reden_nvt) openNotitie('reden')
}

// Gesprongen vanuit een kaart of het stoplicht: in beeld en even oplichten.
watch(nadruk, async (id) => {
  if (id !== props.regel.id) return
  nadruk.value = null
  await nextTick()
  rij.value?.scrollIntoView({ behavior: minderBeweging() ? 'auto' : 'smooth', block: 'center' })
  setTimeout(() => {
    gloed.value = true
    setTimeout(() => (gloed.value = false), 1600)
  }, minderBeweging() ? 0 : 400)
}, { immediate: true })
</script>

<template>
  <div ref="rij" class="rij" :class="{ gloed }" :data-licht="regel.b.licht">
    <div class="rij-hoofd">
      <span><StatusTab :licht="regel.b.licht" :woord="regel.b.woord" /></span>
      <span class="titel">
        {{ regel.titel }}
        <small v-if="regel.uitzondering">Uitzondering<span v-if="kandidaat" class="kandidaat">komt vaak voor</span></small>
        <small v-else-if="t?.status === 'nvt' && t.reden_nvt">{{ t.reden_nvt }}</small>
      </span>
      <span data-kol="eigenaar">
        <select class="eigenaar" :value="t?.eigenaar ?? ''" :aria-label="`Eigenaar ${regel.titel}`" @change="e => emit('wijzig', { eigenaar: tekst(e) })">
          <option value="">—</option>
          <option v-for="m in eigenaren" :key="m" :value="m">{{ m }}</option>
        </select>
      </span>
      <span class="deadline n" data-kol="deadline">
        <template v-if="regel.uitzondering">
          <input class="datum-in-regel" type="date" :value="t?.deadline ?? ''" :aria-label="`Deadline ${regel.titel}`" @change="e => emit('wijzig', { deadline: tekst(e) })">
          <small v-if="regel.b.deadline" :class="urgent ? regel.b.licht : ''">{{ regel.b.reden }}</small>
        </template>
        <template v-else-if="regel.b.deadline">
          {{ fmt(regel.b.deadline) }}<small :class="urgent ? regel.b.licht : ''">{{ regel.b.reden }}</small>
        </template>
        <span v-else class="klein">{{ regel.b.licht === 'later' ? '—' : regel.b.reden }}</span>
      </span>
      <label class="akkoord" :title="akkoordTekst" data-kol="akkoord">
        <input type="checkbox" :checked="t?.klantakkoord ?? false" :aria-label="`Klantakkoord ${regel.titel}`" @change="e => emit('wijzig', { klantakkoord: (e.target as HTMLInputElement).checked })">
      </label>
      <span class="doc-cel" data-kol="document">
        <input
          v-if="docBewerken" ref="docVeld" class="veld doc-veld" :value="t?.document_url ?? ''" placeholder="Plak de link uit SharePoint"
          :aria-label="`Link naar het document bij ${regel.titel}`" @keydown.enter.prevent="bewaarDocument" @keydown.esc.prevent="docBewerken = false" @blur="bewaarDocument"
        >
        <template v-else-if="bestand">
          <a v-if="bestand.url" class="doc" :href="bestand.url" target="_blank" rel="noopener" :title="bestand.naam"><span>{{ bestand.naam }}</span>↗</a>
          <span v-else class="doc" :title="`${bestand.naam} (voorbeeldbestand, geen link)`"><span>{{ bestand.naam }}</span></span>
          <button type="button" class="doc-wijzig" title="Andere link, of leeg laten om het document weg te halen" :aria-label="`Ander document bij ${regel.titel}`" @click="bewerkDocument">
            <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2l3 3-8 8H3v-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
          </button>
        </template>
        <button v-else type="button" class="doc-leeg" @click="bewerkDocument">+ Koppel document</button>
      </span>
      <span data-kol="status">
        <select class="veld pil" :value="t?.status ?? 'niet_gestart'" :title="definitiefTekst" :aria-label="`Status ${regel.titel}`" @change="kiesStatus">
          <option v-for="s in STATUSSEN" :key="s.id" :value="s.id">{{ s.naam }}</option>
        </select>
      </span>
      <span class="notitie-plek">
        <button
          ref="notitieKnop" type="button" class="notitie-knop" :class="{ heeft: lijst.length > 0 }" :aria-expanded="notitieOpen" aria-haspopup="dialog"
          :aria-label="`${knopTekst} bij ${regel.titel}`" :title="knopTekst"
          @click="notitieOpen ? sluitNotitie() : openNotitie()"
        >
          <span v-if="lijst.length" class="notitie-aantal" aria-hidden="true">{{ lijst.length }}</span>
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h7l3 3v9H3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /><path d="M5.5 7.5h5M5.5 10.5h5" stroke="currentColor" stroke-width="1.6" /></svg>
        </button>
      </span>
    </div>

    <Teleport to="body">
      <Transition name="pop">
        <div
          v-if="notitieOpen" ref="paneel" class="notitie-paneel" role="dialog" :aria-label="`Opmerkingen bij ${regel.titel}`"
          :style="plek"
        >
          <p class="notitie-titel">{{ regel.titel }}</p>
          <div class="opmerkingen-blok">
            <span class="label">Opmerkingen</span>
            <ol v-if="lijst.length" ref="lijstEl" class="opmerkingen">
              <li v-for="o in lijst" :key="o.id">
                <p class="opmerking-kop"><b>{{ o.door }}</b><time :datetime="o.op">{{ fmtMoment(o.op, nu) }}</time></p>
                <p class="opmerking-tekst">{{ o.tekst }}</p>
              </li>
            </ol>
            <p v-else class="klein leeg">Nog geen opmerkingen.</p>
            <div class="opmerking-nieuw">
              <textarea
                ref="opmerkingVeld" v-model="concept" class="veld" rows="3" placeholder="Wat moet de volgende weten?" aria-label="Nieuwe opmerking"
                @keydown.enter.meta.prevent="plaatsConcept" @keydown.enter.ctrl.prevent="plaatsConcept"
              />
              <button type="button" class="knop klein zwart" :disabled="!concept.trim() || plaatsBezig" title="Of Ctrl+Enter" @click="plaatsConcept">Plaatsen</button>
            </div>
          </div>
          <label v-if="t?.status === 'nvt'">
            <span class="label">Reden n.v.t.</span>
            <input ref="redenVeld" class="veld" :value="t?.reden_nvt ?? ''" placeholder="Waarom is dit niet van toepassing?" @keydown.enter.prevent="sluitNotitie">
          </label>
          <label v-if="regel.uitzondering">
            <span class="label">Aanleiding</span>
            <input ref="aanleidingVeld" class="veld" :value="t?.aanleiding ?? ''" placeholder="Waarom is dit nodig in dit project?" @keydown.enter.prevent="sluitNotitie">
          </label>
          <p class="klein spoor-regel">{{ definitiefTekst }}<template v-if="t?.klantakkoord_door"><br>{{ akkoordTekst }}</template></p>
          <div class="notitie-knoppen">
            <button type="button" class="knop klein" @click="sluitNotitie">Klaar</button>
            <button v-if="regel.uitzondering" type="button" class="link" @click="notitieOpen = false; emit('verwijder')">Uitzondering weghalen</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

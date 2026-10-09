<script setup lang="ts">
import type { TaakRegel } from '~/lib/stoplicht'
import type { Status, TaakWijziging } from '~/lib/types'
import { EIGENAREN } from '~/lib/fasen'
import { naamUitLink, STATUSSEN } from '~/lib/taak'
import { fmt, naarDatum } from '~/lib/datum'
import { isKandidaat } from '~/lib/uitzonderingen'

// Eén taak op één regel, zonder uitklap: het document koppel je in de regel zelf,
// de notitie (en reden n.v.t., aanleiding, spoor) staat achter het notitie-icoon.
const props = defineProps<{ regel: TaakRegel }>()
const emit = defineEmits<{ wijzig: [w: TaakWijziging], verwijder: [] }>()
const { gebruik, bereikt, nadruk } = useKaart()
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
const afgetekend = computed(() => t.value?.afgetekend_door ? `Afgetekend door ${t.value.afgetekend_door} op ${fmt(naarDatum(t.value.afgetekend_op))}` : 'Nog niet afgetekend')
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

// ---------- notitie: een klein venster bij het icoon ----------
const notitieOpen = ref(false)
const notitieKnop = ref<HTMLElement>()
const paneel = ref<HTMLElement>()
const notitieVeld = ref<HTMLTextAreaElement>()
const redenVeld = ref<HTMLInputElement>()
const aanleidingVeld = ref<HTMLInputElement>()
/** Onder het icoon, of erboven als daar geen ruimte is. Op mobiel een paneel onderaan (CSS). */
const plek = ref<Record<string, string>>({})
function plaats() {
  const r = notitieKnop.value?.getBoundingClientRect()
  if (!r) return
  const onder = r.bottom + 320 < innerHeight || r.top < 320
  plek.value = { right: `${Math.max(16, innerWidth - r.right)}px`, ...(onder ? { top: `${r.bottom + 6}px` } : { bottom: `${innerHeight - r.top + 6}px` }) }
}

async function openNotitie(focus: 'notitie' | 'reden' = 'notitie') {
  plaats()
  notitieOpen.value = true
  await nextTick()
  ;(focus === 'reden' ? redenVeld.value : notitieVeld.value)?.focus()
}
/** Alles in het venster in één keer bewaren, ook bij Escape, ernaast klikken of weggaan. */
function bewaarVenster() {
  const w: TaakWijziging = {}
  const waarde = (veld?: HTMLInputElement | HTMLTextAreaElement) => veld ? veld.value.trim() || null : undefined
  const notitie = waarde(notitieVeld.value)
  const reden = waarde(redenVeld.value)
  const aanleiding = waarde(aanleidingVeld.value)
  if (notitie !== undefined && notitie !== (t.value?.notitie ?? null)) w.notitie = notitie
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
        <small v-if="t?.notitie" class="notitie-regel">{{ t.notitie }}</small>
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
        <select class="veld pil" :value="t?.status ?? 'niet_gestart'" :title="afgetekend" :aria-label="`Status ${regel.titel}`" @change="kiesStatus">
          <option v-for="s in STATUSSEN" :key="s.id" :value="s.id">{{ s.naam }}</option>
        </select>
      </span>
      <span class="notitie-plek">
        <button
          ref="notitieKnop" type="button" class="notitie-knop" :class="{ heeft: !!t?.notitie }" :aria-expanded="notitieOpen" aria-haspopup="dialog"
          :aria-label="t?.notitie ? `Notitie bij ${regel.titel}: ${t.notitie}` : `Notitie maken bij ${regel.titel}`" :title="t?.notitie || 'Notitie maken'"
          @click="notitieOpen ? sluitNotitie() : openNotitie()"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h7l3 3v9H3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /><path d="M5.5 7.5h5M5.5 10.5h5" stroke="currentColor" stroke-width="1.6" /></svg>
        </button>
      </span>
    </div>

    <Teleport to="body">
      <Transition name="pop">
        <div
          v-if="notitieOpen" ref="paneel" class="notitie-paneel" role="dialog" :aria-label="`Notitie bij ${regel.titel}`"
          :style="plek"
        >
          <p class="notitie-titel">{{ regel.titel }}</p>
          <label>
            <span class="label">Notitie</span>
            <textarea ref="notitieVeld" class="veld" rows="3" :value="t?.notitie ?? ''" placeholder="Wat moet de volgende weten?" />
          </label>
          <label v-if="t?.status === 'nvt'">
            <span class="label">Reden n.v.t.</span>
            <input ref="redenVeld" class="veld" :value="t?.reden_nvt ?? ''" placeholder="Waarom is dit niet van toepassing?" @keydown.enter.prevent="sluitNotitie">
          </label>
          <label v-if="regel.uitzondering">
            <span class="label">Aanleiding</span>
            <input ref="aanleidingVeld" class="veld" :value="t?.aanleiding ?? ''" placeholder="Waarom is dit nodig in dit project?" @keydown.enter.prevent="sluitNotitie">
          </label>
          <p class="klein spoor-regel">{{ afgetekend }}<template v-if="t?.klantakkoord_door"><br>{{ akkoordTekst }}</template></p>
          <div class="notitie-knoppen">
            <button type="button" class="knop klein" @click="sluitNotitie">Klaar</button>
            <button v-if="regel.uitzondering" type="button" class="link" @click="notitieOpen = false; emit('verwijder')">Uitzondering weghalen</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { TaakRegel } from '~/lib/stoplicht'
import type { Status, TaakWijziging } from '~/lib/types'
import { EIGENAREN } from '~/lib/fasen'
import { naamUitLink, STATUSSEN } from '~/lib/taak'
import { fmt, naarDatum } from '~/lib/datum'
import { isKandidaat } from '~/lib/uitzonderingen'

const props = defineProps<{ regel: TaakRegel }>()
const emit = defineEmits<{ wijzig: [w: TaakWijziging], verwijder: [] }>()
const { gebruik, bereikt, nadruk } = useKaart()
const { toon } = useToast()

const open = ref(false)
const gloed = ref(false)
const rij = ref<HTMLElement>()
const docVeld = ref<HTMLInputElement>()
const redenVeld = ref<HTMLInputElement>()

const t = computed(() => props.regel.taak)
const eigenaren = computed(() => t.value?.eigenaar && !EIGENAREN.includes(t.value.eigenaar) ? [...EIGENAREN, t.value.eigenaar] : EIGENAREN)
const kandidaat = computed(() => {
  const u = props.regel.uitzondering
  return !!u && u.status !== 'standaard' && isKandidaat(gebruik.value.get(u.id) ?? 0, bereikt(u.fase))
})
const urgent = computed(() => props.regel.b.licht === 'telaat' || props.regel.b.licht === 'letop')
const bestand = computed(() => t.value?.document_url || t.value?.document_naam ? { url: t.value.document_url, naam: t.value.document_naam || naamUitLink(t.value.document_url!) } : null)

async function openMet(veld?: HTMLInputElement | undefined | (() => HTMLInputElement | undefined)) {
  open.value = true
  await nextTick()
  setTimeout(() => (typeof veld === 'function' ? veld() : veld)?.focus(), minderBeweging() ? 0 : 250)
}

function kiesStatus(e: Event) {
  const status = (e.target as HTMLSelectElement).value as Status
  emit('wijzig', { status })
  if (status === 'nvt' && !t.value?.reden_nvt) openMet(() => redenVeld.value)
}

function zetDocument(e: Event) {
  const waarde = (e.target as HTMLInputElement).value.trim()
  if (waarde && !/^https?:\/\//i.test(waarde)) {
    toon('Plak een link die begint met https://, bijvoorbeeld uit SharePoint.', 'fout')
    return
  }
  emit('wijzig', waarde ? { document_url: waarde, document_naam: naamUitLink(waarde) } : { document_url: null, document_naam: null })
}

const tekst = (e: Event) => (e.target as HTMLInputElement | HTMLTextAreaElement).value.trim() || null

// Gesprongen vanuit een kaart of het stoplicht: openklappen en even oplichten.
watch(nadruk, async (id) => {
  if (id !== props.regel.id) return
  nadruk.value = null
  await nextTick()
  rij.value?.scrollIntoView({ behavior: minderBeweging() ? 'auto' : 'smooth', block: 'center' })
  setTimeout(() => {
    open.value = true
    gloed.value = true
    setTimeout(() => (gloed.value = false), 1600)
  }, minderBeweging() ? 0 : 400)
}, { immediate: true })
</script>

<template>
  <div ref="rij" class="rij" :class="{ open, gloed }" :data-licht="regel.b.licht">
    <div class="rij-hoofd">
      <span><StatusTab :licht="regel.b.licht" :woord="regel.b.woord" /></span>
      <span class="titel">
        {{ regel.titel }}
        <small v-if="regel.uitzondering">Uitzondering<span v-if="kandidaat" class="kandidaat">komt vaak voor</span></small>
        <small v-else-if="t?.status === 'nvt' && t.reden_nvt">{{ t.reden_nvt }}</small>
        <small v-else-if="t?.notitie">{{ t.notitie }}</small>
      </span>
      <span data-kol="eigenaar">
        <select class="eigenaar" :value="t?.eigenaar ?? ''" :aria-label="`Eigenaar ${regel.titel}`" @change="e => emit('wijzig', { eigenaar: tekst(e) })">
          <option value="">—</option>
          <option v-for="m in eigenaren" :key="m" :value="m">{{ m }}</option>
        </select>
      </span>
      <span class="deadline n" data-kol="deadline">
        <template v-if="regel.b.deadline">
          {{ fmt(regel.b.deadline) }}<small :class="urgent ? regel.b.licht : ''">{{ regel.b.reden }}</small>
        </template>
        <span v-else class="klein">{{ regel.b.licht === 'later' ? '—' : regel.b.reden }}</span>
      </span>
      <label class="akkoord" title="Klantakkoord" data-kol="akkoord">
        <input type="checkbox" :checked="t?.klantakkoord ?? false" :aria-label="`Klantakkoord ${regel.titel}`" @change="e => emit('wijzig', { klantakkoord: (e.target as HTMLInputElement).checked })">
      </label>
      <span data-kol="document">
        <a v-if="bestand?.url" class="doc" :href="bestand.url" target="_blank" rel="noopener" :title="bestand.naam"><span>{{ bestand.naam }}</span>↗</a>
        <span v-else-if="bestand" class="doc" :title="`${bestand.naam} (voorbeeldbestand, geen link)`"><span>{{ bestand.naam }}</span></span>
        <button v-else type="button" class="doc-leeg" @click="openMet(() => docVeld)">+ Koppel document</button>
      </span>
      <span>
        <select class="veld pil" :value="t?.status ?? 'niet_gestart'" :aria-label="`Status ${regel.titel}`" @change="kiesStatus">
          <option v-for="s in STATUSSEN" :key="s.id" :value="s.id">{{ s.naam }}</option>
        </select>
      </span>
      <button type="button" class="uitklap" :aria-expanded="open" :aria-label="`Details ${regel.titel}`" @click="open = !open">
        <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="#111" stroke-width="2" /></svg>
      </button>
    </div>
    <div class="rij-detail">
      <div>
        <div class="detail-in">
          <div>
            <label :for="`notitie-${regel.id}`">Notitie</label>
            <textarea :id="`notitie-${regel.id}`" class="veld" rows="2" :value="t?.notitie ?? ''" placeholder="Wat moet de volgende weten?" @change="e => emit('wijzig', { notitie: tekst(e) })" />
          </div>
          <div>
            <label :for="`doc-${regel.id}`">Document in SharePoint</label>
            <input :id="`doc-${regel.id}`" ref="docVeld" class="veld" :value="t?.document_url ?? ''" placeholder="Plak de link naar het definitieve bestand" @change="zetDocument">
            <p class="klein" style="margin:6px 0 0">Straks kies je het bestand direct uit de projectmap.</p>
          </div>
          <div>
            <template v-if="t?.status === 'nvt'">
              <label :for="`reden-${regel.id}`">Reden n.v.t.</label>
              <input :id="`reden-${regel.id}`" ref="redenVeld" class="veld" :value="t?.reden_nvt ?? ''" placeholder="Waarom is dit niet van toepassing?" @change="e => emit('wijzig', { reden_nvt: tekst(e) })">
            </template>
            <template v-else-if="regel.uitzondering">
              <label :for="`deadline-${regel.id}`">Deadline</label>
              <input :id="`deadline-${regel.id}`" class="veld" type="date" :value="t?.deadline ?? ''" @change="e => emit('wijzig', { deadline: tekst(e) })">
            </template>
            <label v-else>Spoor</label>
            <p class="spoor-tekst">
              <template v-if="t?.afgetekend_door">Afgetekend door <b>{{ t.afgetekend_door }}</b> op <b>{{ fmt(naarDatum(t.afgetekend_op)) }}</b></template>
              <template v-else>Nog niet afgetekend</template>
              <template v-if="t?.klantakkoord_door"><br>Klantakkoord vastgelegd door <b>{{ t.klantakkoord_door }}</b> op <b>{{ fmt(naarDatum(t.klantakkoord_op)) }}</b></template>
            </p>
          </div>
          <div v-if="regel.uitzondering" class="uitz-detail">
            <label :for="`aanleiding-${regel.id}`">Aanleiding</label>
            <input :id="`aanleiding-${regel.id}`" class="veld" :value="t?.aanleiding ?? ''" placeholder="Waarom is dit nodig in dit project?" @change="e => emit('wijzig', { aanleiding: tekst(e) })">
            <button type="button" class="link" @click="emit('verwijder')">Uitzondering weghalen</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

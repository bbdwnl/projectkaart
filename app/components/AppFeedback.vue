<script setup lang="ts">
// Feedback op de app: een knop rechtsonder, op elke pagina achter de login. Hij opent op die plek een klein venster
// met een notitie en Markeer de plek: daarna klik je op de pagina waar het over gaat, en daar komt een speld.
// Pagina, plek, wat daar staat en de schermmaat gaan mee, zodat de plek terug te vinden is. Lezen doet het MT in
// Supabase (tabel feedback).
const bron = useBron()
const { toon } = useToast()
const route = useRoute()

const open = ref(false)
const markeren = ref(false)
const bezig = ref(false)
const tekst = ref('')
const plek = ref<{ x: number, y: number, element: string } | null>(null)
const knop = ref<HTMLButtonElement>()
const veld = ref<HTMLTextAreaElement>()
const wortel = ref<HTMLElement>()

/** Het element op de plek, kort: tag, id en klassen van het element en twee ouders, plus een stukje tekst. */
function beschrijf(el: Element | null): string {
  const delen: string[] = []
  for (let e = el, i = 0; e && e !== document.body && i < 3; e = e.parentElement, i++) {
    const klassen = [...e.classList].slice(0, 3).map(k => `.${k}`).join('')
    delen.unshift(`${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${klassen}`)
  }
  const stuk = (el as HTMLElement | null)?.innerText?.trim().replace(/\s+/g, ' ').slice(0, 120)
  return [delen.join(' > '), stuk && `"${stuk}"`].filter(Boolean).join(' ').slice(0, 500)
}

async function openen() {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    veld.value?.focus()
  }
}

async function startMarkeren() {
  markeren.value = true
}

/** De klik op de pagina: het element eronder, zonder de laag van de feedback zelf. */
async function markeer(e: MouseEvent) {
  const onder = document.elementsFromPoint(e.clientX, e.clientY).find(el => !wortel.value?.contains(el)) ?? null
  plek.value = { x: Math.round(e.pageX), y: Math.round(e.pageY), element: beschrijf(onder) }
  markeren.value = false
  await nextTick()
  veld.value?.focus()
}

function sluit() {
  if (markeren.value) markeren.value = false
  else open.value = false
  if (!open.value) knop.value?.focus()
}

async function verstuur() {
  const t = tekst.value.trim()
  if (!t) {
    toon('Schrijf eerst wat je opvalt.', 'fout')
    veld.value?.focus()
    return
  }
  bezig.value = true
  try {
    await bron.stuurFeedback({
      tekst: t,
      pad: route.fullPath.slice(0, 500),
      plek_x: plek.value?.x ?? null,
      plek_y: plek.value?.y ?? null,
      element: plek.value?.element || null,
      scherm_breedte: window.innerWidth,
      scherm_hoogte: window.innerHeight,
      browser: navigator.userAgent.slice(0, 500),
    })
    tekst.value = ''
    plek.value = null
    open.value = false
    toon('Bedankt voor je feedback')
  } catch (e) {
    toon(foutTekst(e), 'fout')
  } finally {
    bezig.value = false
  }
}

// Een plek hoort bij een pagina: op een andere pagina is hij weg (de notitie blijft staan).
watch(() => route.path, () => {
  plek.value = null
  markeren.value = false
})

function toets(e: KeyboardEvent) {
  if (e.key === 'Escape' && (open.value || markeren.value)) sluit()
}
onMounted(() => window.addEventListener('keydown', toets))
onBeforeUnmount(() => window.removeEventListener('keydown', toets))
</script>

<template>
  <div ref="wortel" class="feedback">
    <Teleport to="body">
      <span v-if="plek && open" class="feedback-speld" :style="{ left: `${plek.x}px`, top: `${plek.y}px` }" aria-hidden="true" />
    </Teleport>

    <div v-if="markeren" class="feedback-markeer" @click="markeer">
      <p class="feedback-hint" role="status">Klik op de plek waar je feedback over gaat <button type="button" class="link" @click.stop="sluit">Stoppen</button></p>
    </div>

    <Transition name="feedback">
      <form v-if="open && !markeren" id="feedback-paneel" class="feedback-paneel" aria-labelledby="feedback-titel" @submit.prevent="verstuur">
        <p id="feedback-titel" class="feedback-titel">Feedback</p>
        <label>
          <span class="label">Wat valt je op?</span>
          <textarea ref="veld" v-model="tekst" class="veld" rows="4" maxlength="4000" placeholder="Wat klopt er niet, wat mist er, wat kan beter?" />
        </label>
        <div class="feedback-plek">
          <template v-if="plek">
            <span class="klein"><i class="feedback-stip" aria-hidden="true" />Plek gemarkeerd</span>
            <button type="button" class="link" @click="startMarkeren">Opnieuw</button>
            <button type="button" class="link" @click="plek = null">Weghalen</button>
          </template>
          <button v-else type="button" class="knop klein" @click="startMarkeren">Markeer de plek</button>
        </div>
        <div class="knoppen">
          <button type="submit" class="knop zwart klein" :disabled="bezig">{{ bezig ? 'Versturen…' : 'Versturen' }}</button>
          <button type="button" class="link" @click="sluit">Annuleren</button>
        </div>
      </form>
    </Transition>

    <button v-show="!markeren" ref="knop" type="button" class="feedback-knop" :aria-expanded="open" aria-controls="feedback-paneel" @click="openen">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /></svg>
      Feedback
    </button>
  </div>
</template>

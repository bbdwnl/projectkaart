<script setup lang="ts">
import { isKandidaat } from '~/lib/uitzonderingen'
import { naarIso, plusDagen } from '~/lib/datum'

// Uitzondering toevoegen: kies uit de catalogus (dan is te tellen hoe vaak iets voorkomt), of maak een nieuwe.
const { catalogus, taken, gebruik, bereikt, tabFase, nu, voegUitzonderingToe, gaNaar } = useKaart()

const zoek = ref('')
const open = ref(false)
const actief = ref(0)
const bezig = ref(false)
const plek = ref<HTMLElement>()

const suggesties = computed(() => {
  const al = new Set(taken.value.map(t => t.uitzondering_id).filter(Boolean))
  const z = zoek.value.trim().toLowerCase()
  return catalogus.value
    .filter(u => !al.has(u.id) && u.status !== 'standaard' && (!z || u.titel.toLowerCase().includes(z)))
    .map(u => ({ ...u, aantal: gebruik.value.get(u.id) ?? 0, van: bereikt(u.fase) }))
    .sort((a, b) => Number(b.fase === tabFase.value) - Number(a.fase === tabFase.value) || b.aantal - a.aantal)
    .slice(0, 6)
})
const nieuw = computed(() => {
  const z = zoek.value.trim()
  return z.length >= 2 && !catalogus.value.some(u => u.titel.toLowerCase() === z.toLowerCase()) ? z : null
})
const keuzes = computed(() => [...suggesties.value.map(s => ({ id: s.id, nieuw: null as string | null })), ...(nieuw.value ? [{ id: null, nieuw: nieuw.value }] : [])])

async function kies(id: string | null, titel: string | null) {
  if (bezig.value) return
  bezig.value = true
  const taak = await voegUitzonderingToe({ uitzonderingId: id ?? undefined, nieuweTitel: titel ?? undefined, fase: tabFase.value, deadline: naarIso(plusDagen(nu, 21)) })
  bezig.value = false
  if (!taak) return
  zoek.value = ''
  open.value = false
  await nextTick()
  gaNaar(`uitz:${taak.id}`)
}

function toets(e: KeyboardEvent) {
  if (!open.value) return
  const n = keuzes.value.length
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    actief.value = (actief.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % Math.max(1, n)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const k = keuzes.value[actief.value] ?? keuzes.value[0]
    if (k) kies(k.id, k.nieuw)
  } else if (e.key === 'Escape') {
    open.value = false
  }
}
watch(zoek, () => (actief.value = 0))

function buiten(e: MouseEvent) {
  if (plek.value && !plek.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('click', buiten))
onBeforeUnmount(() => document.removeEventListener('click', buiten))
</script>

<template>
  <div ref="plek" class="uitz-balk">
    <input
      v-model="zoek" class="veld" placeholder="Uitzondering toevoegen, bijvoorbeeld bodemonderzoek" autocomplete="off"
      aria-label="Uitzondering zoeken of toevoegen" :aria-expanded="open" role="combobox" aria-controls="uitz-suggesties"
      @focus="open = true" @input="open = true" @keydown="toets"
    >
    <span class="klein">Kies uit de catalogus, zodat we kunnen tellen hoe vaak iets voorkomt.</span>
    <Transition name="pop">
      <div v-if="open && keuzes.length" id="uitz-suggesties" class="suggesties" role="listbox">
        <button
          v-for="(s, i) in suggesties" :key="s.id" type="button" role="option" :aria-selected="actief === i"
          :class="{ actief: actief === i }" @click="kies(s.id, null)"
        >
          <span>{{ s.titel }}<span v-if="isKandidaat(s.aantal, s.van)" class="kandidaat">kandidaat standaard</span></span>
          <small>in {{ s.aantal }} van {{ s.van }} projecten</small>
        </button>
        <button
          v-if="nieuw" type="button" role="option" class="nieuw" :aria-selected="actief === suggesties.length"
          :class="{ actief: actief === suggesties.length }" @click="kies(null, nieuw)"
        >
          <span>Nieuwe uitzondering: “{{ nieuw }}”</span><small>komt in de catalogus</small>
        </button>
      </div>
    </Transition>
  </div>
</template>

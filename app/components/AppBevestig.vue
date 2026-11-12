<script setup lang="ts">
// Het venster voor useBevestig(): een vraag in de stijl van de app, in plaats van confirm() of prompt().
const { open } = useBevestig()

const venster = ref<HTMLDialogElement>()
const jaKnop = ref<HTMLButtonElement>()
const veld = ref<HTMLTextAreaElement>()
const invoer = ref('')
let beantwoord = false

watch(() => open.value?.id, async (id) => {
  if (!id) return
  invoer.value = ''
  beantwoord = false
  await nextTick()
  if (!venster.value?.open) venster.value?.showModal()
  ;(open.value?.invoer ? veld.value : jaKnop.value)?.focus()
})

function antwoord(a: string | boolean | null) {
  const v = open.value
  if (!v || beantwoord) return
  beantwoord = true
  v.klaar(a)
  open.value = null
  venster.value?.close()
}
const ja = () => {
  if (!open.value?.invoer) return antwoord(true)
  if (invoer.value.trim()) antwoord(invoer.value.trim())
}
const nee = () => antwoord(open.value?.invoer ? null : false)
</script>

<template>
  <dialog ref="venster" class="datumvenster bevestig" aria-labelledby="bevestig-titel" @close="nee" @click.self="nee">
    <form v-if="open" class="datumvenster-in" @submit.prevent="ja">
      <header class="datumvenster-kop">
        <h2 id="bevestig-titel">{{ open.titel }}</h2>
        <button type="button" class="sluit-knop" aria-label="Annuleren" @click="nee">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>
        </button>
      </header>
      <p v-if="open.tekst" class="bevestig-tekst">{{ open.tekst }}</p>
      <label v-if="open.invoer" class="datumvenster-veld">
        <span class="label">{{ open.label ?? 'Toelichting' }}</span>
        <textarea
          ref="veld" v-model="invoer" class="veld" rows="3" :placeholder="open.placeholder"
          @keydown.enter.meta.prevent="ja" @keydown.enter.ctrl.prevent="ja"
        />
      </label>
      <div class="datumvenster-knoppen">
        <button ref="jaKnop" type="submit" class="knop zwart" :class="{ gevaar: open.gevaar }" :disabled="open.invoer && !invoer.trim()">{{ open.ja ?? 'Ja' }}</button>
        <button type="button" class="knop" @click="nee">{{ open.nee ?? 'Annuleren' }}</button>
      </div>
    </form>
  </dialog>
</template>

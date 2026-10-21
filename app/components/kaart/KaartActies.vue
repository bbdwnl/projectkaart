<script setup lang="ts">
import type { Actie } from '~/lib/types'
import { EIGENAREN } from '~/lib/fasen'
import { fmt, naarDatum } from '~/lib/datum'

// De actielijst van het overleg (zoals in het prototype): genummerd in volgorde van aanmaken, met actiehouder,
// deadline en gereed. Wie een actie maakte en gereed meldde, vult de database in. Onder Projecten mail je iedereen
// zijn open acties.
const { project, acties, openActies, nieuweActie, wijzigActie, verwijderActie, nu } = useKaart()
const toonGereed = ref(false)
const lijstEl = ref<HTMLElement>()

const nummers = computed(() => new Map(acties.value.map((a, i) => [a.id, i + 1])))
const zichtbaar = computed(() => acties.value.filter(a => toonGereed.value || !a.gereed))
const teLaat = (a: Actie) => !a.gereed && !!a.deadline && naarDatum(a.deadline)! < nu
const aantalTeLaat = computed(() => openActies.value.filter(teLaat).length)
/** De vaste namen, de mensen van dit project en wie er al actiehouder is. */
const houders = computed(() => {
  const p = project.value
  const extra = [p?.pm, p?.opzichter, p?.po, p?.am, ...acties.value.map(a => a.actiehouder)].filter((n): n is string => !!n)
  return [...new Set([...EIGENAREN, ...extra])]
})

async function voegToe() {
  const a = await nieuweActie()
  if (!a) return
  await nextTick()
  lijstEl.value?.querySelector<HTMLInputElement>(`#actie-${a.id}`)?.focus()
}
function tekst(a: Actie, e: Event) {
  const waarde = (e.target as HTMLInputElement).value.trim()
  if (waarde !== a.tekst) wijzigActie(a, { tekst: waarde })
}
function weg(a: Actie) {
  if (!a.tekst || confirm(`Actie ${nummers.value.get(a.id)} weghalen: ${a.tekst}?`)) verwijderActie(a)
}
const gemaakt = (a: Actie) => fmt(new Date(a.aangemaakt_op))
</script>

<template>
  <div id="paneel-acties" class="paneel" role="tabpanel" aria-labelledby="tab-acties">
    <section class="blok">
      <div class="blokkop">
        <div>
          <h2>Actielijst overleg</h2>
          <p class="klein">
            De acties uit het overleg: wat, wie en wanneer. {{ openActies.length }} open<template v-if="aantalTeLaat">, <b class="te-laat">{{ aantalTeLaat }} te laat</b></template>.
            Onder <NuxtLink to="/">Projecten</NuxtLink> mail je de actiehouders hun open acties.
          </p>
        </div>
        <label class="schakel"><input v-model="toonGereed" type="checkbox"><span />Toon gereed <small class="n">{{ acties.length - openActies.length }}</small></label>
      </div>

      <div v-if="zichtbaar.length" ref="lijstEl" class="lijst actielijst">
        <div class="kolkop"><span>#</span><span>Actie</span><span>Actiehouder</span><span>Aangemaakt</span><span>Deadline</span><span>Gereed</span><span /></div>
        <div v-for="a in zichtbaar" :key="a.id" class="rij" :class="{ gereed: a.gereed, 'te-laat': teLaat(a) }">
          <div class="rij-hoofd">
            <span class="n nr">{{ nummers.get(a.id) }}</span>
            <input :id="`actie-${a.id}`" class="veld" :value="a.tekst" placeholder="Omschrijf de actie" :aria-label="`Actie ${nummers.get(a.id)}`" @change="e => tekst(a, e)" @keydown.enter="e => (e.target as HTMLInputElement).blur()">
            <select class="veld" :value="a.actiehouder ?? ''" :aria-label="`Actiehouder actie ${nummers.get(a.id)}`" @change="e => wijzigActie(a, { actiehouder: (e.target as HTMLSelectElement).value || null })">
              <option value="">—</option>
              <option v-for="n in houders" :key="n" :value="n">{{ n }}</option>
            </select>
            <span class="klein n" :title="a.aangemaakt_door ? `Door ${a.aangemaakt_door}` : undefined">{{ gemaakt(a) }}</span>
            <span class="deadline">
              <input class="veld" type="date" :value="a.deadline ?? ''" :aria-label="`Deadline actie ${nummers.get(a.id)}`" @change="e => wijzigActie(a, { deadline: (e.target as HTMLInputElement).value || null })">
              <small v-if="teLaat(a)" class="telaat">Te laat</small>
            </span>
            <label class="akkoord" :title="a.gereed && a.gereed_door ? `Gereed gemeld door ${a.gereed_door}` : 'Gereed'">
              <input type="checkbox" :checked="a.gereed" :aria-label="`Actie ${nummers.get(a.id)} gereed`" @change="e => wijzigActie(a, { gereed: (e.target as HTMLInputElement).checked })">
            </label>
            <button type="button" class="actie-weg" :aria-label="`Actie ${nummers.get(a.id)} weghalen`" title="Weghalen" @click="weg(a)">✕</button>
          </div>
        </div>
      </div>
      <p v-else class="leeg-staat">{{ acties.length ? 'Alle acties zijn gereed.' : 'Nog geen acties. Voeg hieronder de acties uit het overleg toe.' }}</p>
      <button type="button" class="knop actie-toevoegen" @click="voegToe">+ Actie toevoegen</button>
    </section>
  </div>
</template>

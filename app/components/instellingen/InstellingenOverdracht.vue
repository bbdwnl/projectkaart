<script setup lang="ts">
import type { Fase } from '~/lib/types'
import { FASEN, faseInfo } from '~/lib/fasen'
import { LIJSTEN } from '~/lib/taken'

// Wat er bij elke overdracht klaar moet zijn (Proces & Planning op de kaart). Elke eis haalt zijn stand uit de taken
// die je eraan koppelt: klaar als die klaar zijn, te laat als er één te laat is. Er is geen harde gate.
const { concept, gewijzigd, bezig, isMt, opgeslagen, opslaan, standaardTerug, herstel } = useInstellingBewerken('overdracht')
const fase = ref<Fase>('haalbaarheid')
const blok = computed(() => concept.value[fase.value])
/** De taken van deze fase om aan een eis te koppelen: het opgeslagen takenpakket. */
const groepen = computed(() => LIJSTEN[fase.value])
const code = (sleutel: string) => `${fase.value}:${sleutel}`
const titelVan = (k: string) => LIJSTEN[k.split(':')[0] as Fase]?.flatMap(g => g.taken).find(t => t.sleutel === k.split(':')[1])?.titel

function koppel(i: number, k: string, aan: boolean) {
  const eis = blok.value.items[i]!
  eis.taken = aan ? [...new Set([...eis.taken, k])] : eis.taken.filter(x => x !== k)
}
function schuif(i: number, d: -1 | 1) {
  const l = blok.value.items
  const [x] = l.splice(i, 1)
  l.splice(i + d, 0, x!)
}
function weg(i: number) {
  if (blok.value.items[i]!.titel && !confirm(`"${blok.value.items[i]!.titel}" weghalen?`)) return
  blok.value.items.splice(i, 1)
}
const nieuw = () => blok.value.items.push({ titel: '', taken: [] })
</script>

<template>
  <section class="blok instellingen">
    <div class="blokkop">
      <div>
        <h2>Overdracht</h2>
        <p class="klein">Per fase wat er bij de overdracht klaar moet zijn. Koppel elke eis aan een of meer taken uit het takenpakket: daaruit rekent hij zijn stand uit. Een nieuwe taak koppel je pas na het opslaan van het takenpakket.</p>
      </div>
      <div class="seg" role="group" aria-label="Fase">
        <button v-for="f in FASEN" :key="f.id" type="button" :aria-pressed="fase === f.id" @click="fase = f.id">{{ f.naam }} <span class="n">{{ concept[f.id].items.length }}</span></button>
      </div>
    </div>
    <fieldset class="kaal inst-pakket" :disabled="!isMt">
      <label class="inst-kop"><span class="label">Kop in de procesflow</span><input v-model="blok.kop" class="veld" maxlength="60" placeholder="Overdracht"></label>
      <div v-for="(eis, i) in blok.items" :key="i" class="kaart inst-groep">
        <div class="inst-groepkop">
          <label><span class="label">Eis {{ i + 1 }}</span><input v-model="eis.titel" class="veld" maxlength="120" placeholder="Bijvoorbeeld Duidelijke scope" :aria-label="`Eis ${i + 1}`"></label>
          <span class="inst-knopjes">
            <button type="button" class="ikoon" :disabled="i === 0" title="Omhoog" aria-label="Omhoog" @click="schuif(i, -1)">↑</button>
            <button type="button" class="ikoon" :disabled="i === blok.items.length - 1" title="Omlaag" aria-label="Omlaag" @click="schuif(i, 1)">↓</button>
            <button type="button" class="ikoon" title="Weghalen" aria-label="Weghalen" @click="weg(i)">✕</button>
          </span>
        </div>
        <details class="inst-koppel" :open="!eis.taken.length">
          <summary class="klein">
            <template v-if="eis.taken.length">Gekoppeld: {{ eis.taken.map(k => titelVan(k) ?? `${k} (niet meer in het pakket)`).join(' · ') }}</template>
            <template v-else><b>Nog aan geen taak gekoppeld</b>: dan blijft hij open.</template>
          </summary>
          <div v-for="g in groepen" :key="g.titel" class="inst-koppelgroep">
            <p class="label">{{ g.titel }}</p>
            <label v-for="t in g.taken" :key="t.sleutel" class="kolpil"><input type="checkbox" :checked="eis.taken.includes(code(t.sleutel))" @change="e => koppel(i, code(t.sleutel), (e.target as HTMLInputElement).checked)"><span>{{ t.titel }}</span></label>
          </div>
          <p v-if="!groepen.length" class="klein">{{ faseInfo(fase).naam }} heeft geen taken in het pakket.</p>
        </details>
      </div>
      <button type="button" class="knop" @click="nieuw">+ Eis bij {{ faseInfo(fase).naam.toLowerCase() }}</button>
    </fieldset>
    <InstellingenOpslaan :gewijzigd="gewijzigd" :bezig="bezig" :is-mt="isMt" :opgeslagen="opgeslagen" @opslaan="opslaan" @herstel="herstel" @standaard="standaardTerug" />
  </section>
</template>

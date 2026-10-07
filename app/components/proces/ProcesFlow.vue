<script setup lang="ts">
import { EISEN, FASEN, faseIndex, ROLLEN } from '~/lib/fasen'
import { eisStand } from '~/lib/stoplicht'
import type { Licht } from '~/lib/types'

// De procesflow van dit project. Geen harde gate: de punten kleuren mee met de taken.
const { project, taken, nu } = useKaart()

const fi = computed(() => faseIndex(project.value!.fase))
const fasen = computed(() => FASEN.map((f, i) => ({
  ...f,
  stand: i < fi.value ? 'af' : i === fi.value ? 'nu' : 'straks',
  eis: EISEN[f.id],
  punten: EISEN[f.id].items.map(e => ({ titel: e.titel, licht: eisStand(e.taken, project.value!, taken.value, nu) })),
})))
const voortgang = computed(() => fi.value / (FASEN.length - 1))
const WOORD: Record<Licht, string> = { telaat: 'Te laat', letop: 'Let op', klaar: 'Klaar', later: 'N.v.t.', open: 'Open' }

const getekend = ref(false)
onMounted(async () => {
  await volgendBeeld()
  getekend.value = true
})
</script>

<template>
  <section id="proces" class="blok">
    <div class="blokkop">
      <div>
        <h2>Waar het project staat</h2>
        <p class="klein">Bij elke overdracht staat wat er klaar moet zijn. De punten kleuren mee met de taken; de fase zelf kan iedereen aanpassen, en elke wijziging komt in het logboek.</p>
      </div>
    </div>
    <div class="flow" :class="{ klaar: getekend }">
      <div class="banden">
        <div class="band" style="grid-column:1/3"><b>AM</b> · accountmanager</div>
        <div class="band"><b>PO</b> · projectontwikkelaar</div>
        <div class="band" style="grid-column:4/6"><b>PM</b> · projectmanager</div>
      </div>
      <div class="spoor">
        <div class="lijn"><i :style="{ transform: `scaleX(${getekend ? voortgang : 0})` }" /></div>
        <i v-for="(f, i) in fasen" :key="f.id" class="knoop" :class="{ af: f.stand === 'af', nu: f.stand === 'nu' }" :style="{ transitionDelay: `${300 + i * 140}ms` }" />
      </div>
      <div class="fasen">
        <div v-for="f in fasen" :key="f.id" class="fase" :class="f.stand">
          <div class="kaart til">
            <StatusTab :licht="f.stand === 'af' ? 'klaar' : f.stand === 'nu' ? 'nu' : 'later'" :woord="f.stand === 'af' ? 'Afgerond' : f.stand === 'nu' ? 'Nu' : 'Straks'" />
            <span class="rol">{{ ROLLEN[f.rol].kort }}</span>
            <h3>{{ f.naam }}</h3>
            <p>{{ f.wat }}</p>
          </div>
          <div class="eis">
            <h4>{{ f.eis.kop }}</h4>
            <ul>
              <li v-for="p in f.punten" :key="p.titel">
                <i class="punt" :class="p.licht === 'open' ? '' : p.licht" :title="WOORD[p.licht]" />
                <span>{{ p.titel }}<span class="verborgen"> ({{ WOORD[p.licht] }})</span></span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

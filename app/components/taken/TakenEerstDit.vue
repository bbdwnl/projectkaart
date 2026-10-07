<script setup lang="ts">
import { opUrgentie } from '~/lib/stoplicht'
import { fmt } from '~/lib/datum'

// Eerst dit: de dringendste taken van de huidige fase als kaarten.
const { huidig, project, tabFase, filter, gaNaar } = useKaart()
const MAX = 7
const urgent = computed(() => opUrgentie(huidig.value.filter(r => r.b.licht === 'telaat' || r.b.licht === 'letop')))
const zichtbaar = ref(false)
onMounted(async () => {
  await volgendBeeld()
  zichtbaar.value = true
})
function toonAlles() {
  tabFase.value = project.value!.fase
  filter.value = 'open'
  document.getElementById('taken')?.scrollIntoView({ behavior: minderBeweging() ? 'auto' : 'smooth' })
}
</script>

<template>
  <section id="open" class="blok">
    <div class="blokkop">
      <div>
        <h2>De dringendste taken</h2>
        <p class="klein">De taken uit deze fase die aandacht vragen, de meest dringende eerst. Klik op een kaart om naar de taak te gaan.</p>
      </div>
    </div>
    <div v-if="urgent.length" class="open-grid">
      <article
        v-for="(r, i) in urgent.slice(0, MAX)" :key="r.id" class="kaart til onthul" :class="{ zichtbaar }"
        :style="{ transitionDelay: `${i * 60}ms` }" tabindex="0" @click="gaNaar(r.id)" @keydown.enter.space.prevent="gaNaar(r.id)"
      >
        <StatusTab :licht="r.b.licht" :woord="r.b.woord" />
        <h3>{{ r.titel }}</h3>
        <dl>
          <dt>Stand</dt><dd>{{ r.b.reden }}</dd>
          <dt>Deadline</dt><dd class="n">{{ fmt(r.b.deadline) }}</dd>
          <dt>Eigenaar</dt><dd>{{ r.taak?.eigenaar || '—' }}</dd>
          <template v-if="r.uitzondering"><dt>Soort</dt><dd>Uitzondering</dd></template>
        </dl>
      </article>
      <button v-if="urgent.length > MAX" type="button" class="kaart stapel meer" @click="toonAlles">en {{ urgent.length - MAX }} meer · toon alles</button>
    </div>
    <div v-else class="leeg-staat">Niets dat aandacht vraagt in deze fase. Mooi zo.</div>
  </section>
</template>

<script setup lang="ts">
import { dagen } from '~/lib/datum'

const { weergave } = useWeergave()
const { mijlpaal } = useKaart()
const w = computed(() => weergave.value.proces)
const aftel = computed(() => {
  const m = mijlpaal.value
  if (!m) return 'Planning'
  return m.dagen >= 0 ? `Nog ${dagen(m.dagen)} tot ${m.naam}` : `${m.naam[0]!.toUpperCase()}${m.naam.slice(1)} was ${dagen(-m.dagen)} geleden`
})
</script>

<template>
  <div id="paneel-proces" class="paneel" role="tabpanel" aria-labelledby="tab-proces">
    <Transition name="blok">
      <ProcesFlow v-if="w.flow" />
    </Transition>
    <Transition name="blok">
      <section v-if="w.tijdlijn || w.datums" id="planning" class="blok">
        <div class="blokkop">
          <div>
            <h2>{{ aftel }}</h2>
            <p class="klein">Pas een datum aan en alle deadlines rekenen mee. Ontwikkelstukken worden teruggerekend vanaf inkoop gereed, zoals in het prototype.</p>
          </div>
        </div>
        <Transition name="blok"><ProcesTijdlijn v-if="w.tijdlijn" /></Transition>
        <Transition name="blok"><ProcesDatums v-if="w.datums" /></Transition>
      </section>
    </Transition>
    <div v-if="!w.flow && !w.tijdlijn && !w.datums" class="leeg-staat paneel-leeg">Alles op dit tabblad staat uit. Zet onderdelen aan via Weergave aanpassen.</div>
  </div>
</template>

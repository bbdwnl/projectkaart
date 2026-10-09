<script setup lang="ts">
// Wat wil je zien op de projectkaart? Alles wordt meteen bewaard in een cookie op dit apparaat.
// Gebruikt in het paneel Weergave aanpassen, en op mobiel in het menu.
const { weergave, herstel } = useWeergave()
const { gebruiker } = useGebruiker()
const { toon } = useToast()

watch(() => JSON.stringify({ ...weergave.value, tab: null }), () => toon('Weergave bewaard'))

const KOLOMMEN = [['eigenaar', 'Eigenaar'], ['deadline', 'Deadline'], ['akkoord', 'Akkoord'], ['document', 'Document']] as const
</script>

<template>
  <div class="weergave-keuzes">
    <div class="wg-kop">
      <h3>Wat wil je zien?</h3>
      <button type="button" class="link" @click="herstel">Standaard</button>
    </div>
    <div class="wg-groep">
      <h4>Bovenaan</h4>
      <label class="schakel"><input v-model="weergave.kop.stoplicht" type="checkbox"><span />Stoplicht</label>
      <label class="schakel"><input v-model="weergave.kop.planningstrook" type="checkbox"><span />Planningstrook</label>
    </div>
    <div class="wg-groep">
      <h4>Taken</h4>
      <label class="schakel"><input v-model="weergave.taken.eerstDit" type="checkbox"><span />Eerst dit: de dringendste taken als kaarten</label>
      <label class="schakel"><input v-model="weergave.taken.compact" type="checkbox"><span />Compacte rijen</label>
      <div class="kolpillen" role="group" aria-label="Kolommen in de takenlijst">
        <span class="label">Kolommen</span>
        <label v-for="[k, naam] in KOLOMMEN" :key="k" class="kolpil"><input v-model="weergave.taken.kolommen[k]" type="checkbox"><span>{{ naam }}</span></label>
      </div>
    </div>
    <div class="wg-groep">
      <h4>Proces &amp; Planning</h4>
      <label class="schakel"><input v-model="weergave.proces.flow" type="checkbox"><span />Procesflow</label>
      <label class="schakel"><input v-model="weergave.proces.tijdlijn" type="checkbox"><span />Tijdlijn</label>
      <label class="schakel"><input v-model="weergave.proces.datums" type="checkbox"><span />Datums</label>
    </div>
    <div class="wg-groep">
      <h4>Details</h4>
      <label class="schakel"><input v-model="weergave.details.gegevens" type="checkbox"><span />Projectgegevens</label>
      <label class="schakel"><input v-model="weergave.details.leveranciers" type="checkbox"><span />Leveranciers</label>
      <label v-if="gebruiker?.isMt" class="schakel"><input v-model="weergave.details.geld" type="checkbox"><span />Financieel</label>
      <label class="schakel"><input v-model="weergave.details.logboek" type="checkbox"><span />Logboek</label>
    </div>
    <p class="klein wg-voet">Bewaard in een cookie op dit apparaat. De kaart opent met het tabblad dat je het laatst gebruikte.</p>
  </div>
</template>

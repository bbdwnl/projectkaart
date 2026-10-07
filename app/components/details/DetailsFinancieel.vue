<script setup lang="ts">
// Alleen voor het MT (ook afgedwongen in de database).
const { financien } = useKaart()
const { modus } = useGebruiker()

const n = (v: number | null | undefined) => v ?? 0
const euro = (v: number | null | undefined) => v === null || v === undefined ? '—' : `€${Math.round(v).toLocaleString('nl-NL')}`
const cijfers = computed(() => {
  const f = financien.value
  if (!f) return null
  const opdracht = n(f.opdracht_uren) + n(f.opdracht_turnkey) + n(f.opdracht_inkoop_derden)
  const prognose = n(f.prognose_omzet_uren) + n(f.prognose_omzet_turnkey)
  return {
    opdracht, prognose,
    gefactureerd: n(f.omzet_gefactureerd),
    resultaat: n(f.bm_werkelijk) - n(f.kosten_uren),
    dekking: prognose ? Math.round(opdracht / prognose * 100) : 0,
    gefactureerdDeel: opdracht ? Math.round(n(f.omzet_gefactureerd) / opdracht * 100) : 0,
  }
})
// De kolommen van het financieel overzicht in het prototype.
const groepen = computed(() => {
  const f = financien.value
  if (!f) return []
  return [
    { kop: 'Prognose', regels: [['Omzet uren', f.prognose_omzet_uren], ['Omzet turnkey', f.prognose_omzet_turnkey], ['Inkoop', f.prognose_inkoop]] },
    { kop: 'Werkelijk opdracht', regels: [['Uren', f.opdracht_uren], ['Turnkey', f.opdracht_turnkey], ['Inkoop derden', f.opdracht_inkoop_derden], ['Totaal', cijfers.value?.opdracht ?? null]] },
    { kop: 'Werkelijk', regels: [['Omzet (gefactureerd)', f.omzet_gefactureerd], ['Kosten uren', f.kosten_uren], ['Kosten onderaanneming', f.kosten_onderaanneming], ['BM werkelijk', f.bm_werkelijk], ['Resultaat (BM − kosten uren)', cijfers.value?.resultaat ?? null]] },
  ] as { kop: string, regels: [string, number | null][] }[]
})
const tel = {
  opdracht: useTeller(() => cijfers.value?.opdracht ?? 0, { duur: 1100 }),
  prognose: useTeller(() => cijfers.value?.prognose ?? 0, { duur: 1100, vertraging: 120 }),
  gefactureerd: useTeller(() => cijfers.value?.gefactureerd ?? 0, { duur: 1100, vertraging: 240 }),
  resultaat: useTeller(() => cijfers.value?.resultaat ?? 0, { duur: 1100, vertraging: 360 }),
}
const gevuld = ref(false)
onMounted(async () => {
  await volgendBeeld()
  gevuld.value = true
})
</script>

<template>
  <section id="geld" class="blok">
    <div class="blokkop">
      <div>
        <h2>Financieel</h2>
        <p class="klein">Alleen zichtbaar voor het MT.<template v-if="modus === 'proef'"> Voorbeeldbedragen.</template></p>
      </div>
      <span class="tab later">Alleen MT</span>
    </div>
    <template v-if="financien && cijfers">
      <div class="geld">
        <div class="kaart"><span class="tab">Opdracht</span><p class="label">Totaal in opdracht</p><p class="cijfer">{{ euro(tel.opdracht.value) }}</p><p class="klein">uren {{ euro(financien.opdracht_uren) }} · turnkey {{ euro(financien.opdracht_turnkey) }}</p></div>
        <div class="kaart"><span class="tab">Prognose</span><p class="label">Prognose omzet</p><p class="cijfer">{{ euro(tel.prognose.value) }}</p><p class="klein">opdracht {{ cijfers.dekking }}% van prognose</p><div class="meter"><i :style="{ width: gevuld ? `${Math.min(100, cijfers.dekking)}%` : '0' }" /></div></div>
        <div class="kaart"><span class="tab klaar">Gefactureerd</span><p class="label">Omzet gefactureerd</p><p class="cijfer">{{ euro(tel.gefactureerd.value) }}</p><p class="klein">{{ cijfers.gefactureerdDeel }}% van de opdracht</p><div class="meter"><i :style="{ width: gevuld ? `${Math.min(100, cijfers.gefactureerdDeel)}%` : '0' }" /></div></div>
        <div class="kaart"><span class="tab">Resultaat</span><p class="label">BM − kosten uren</p><p class="cijfer">{{ euro(tel.resultaat.value) }}</p><p class="klein">kosten uren {{ euro(financien.kosten_uren) }}</p></div>
      </div>
      <table class="tabel">
        <thead><tr><th>Post</th><th class="r">Bedrag</th></tr></thead>
        <tbody v-for="g in groepen" :key="g.kop">
          <tr class="kopregel"><td colspan="2">{{ g.kop }}</td></tr>
          <tr v-for="[naam, waarde] in g.regels" :key="naam"><td>{{ naam }}</td><td class="r">{{ euro(waarde) }}</td></tr>
        </tbody>
      </table>
    </template>
    <div v-else class="leeg-staat">Nog geen bedragen voor dit project. Die komen uit het financieel overzicht; de import volgt.</div>
  </section>
</template>

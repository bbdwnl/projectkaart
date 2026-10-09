<script setup lang="ts">
import type { Leverancier, ProjectLeverancier } from '~/lib/types'

// Instellingen voor alle projecten. Nu: de globale lijst met leveranciers, waaruit je op elk project kiest.
useHead({ title: 'Instellingen · Projectkaart' })
const bron = useBron()
const { toon } = useToast()
const stand = ref<'laden' | 'klaar' | 'fout'>('laden')
const fout = ref('')
const leveranciers = ref<Leverancier[]>([])
const koppelingen = ref<ProjectLeverancier[]>([])
const naam = ref('')
const vak = ref('')
const bezig = ref(false)

async function laad() {
  stand.value = 'laden'
  try {
    ;[leveranciers.value, koppelingen.value] = await Promise.all([bron.globaleLeveranciers(), bron.koppelingen()])
    stand.value = 'klaar'
  } catch (e) {
    fout.value = foutTekst(e)
    stand.value = 'fout'
  }
}
onMounted(laad)

const projecten = (id: string) => koppelingen.value.filter(k => k.leverancier_id === id).length
const projectenTekst = (id: string) => {
  const n = projecten(id)
  return n ? `${n} ${n === 1 ? 'project' : 'projecten'}` : 'Nog op geen project'
}
const opNaam = (ls: Leverancier[]) => [...ls].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))

async function voegToe() {
  if (naam.value.trim().length < 2) return toon('Geef de leverancier een naam van minstens twee letters.', 'fout')
  bezig.value = true
  try {
    const l = await bron.nieuweLeverancier(null, { naam: naam.value.trim(), vak: vak.value.trim() || null, globaal: true })
    leveranciers.value = opNaam([...leveranciers.value, l])
    toon(`${l.naam} staat in de globale lijst`)
    naam.value = ''
    vak.value = ''
  } catch (e) {
    toon(foutTekst(e), 'fout')
  } finally {
    bezig.value = false
  }
}

/** Naam of vak aanpassen, meteen bij het verlaten van het veld. Bij een fout komt de oude waarde terug. */
async function wijzig(l: Leverancier, veld: 'naam' | 'vak', e: Event) {
  const invoer = e.target as HTMLInputElement
  const waarde = invoer.value.trim() || null
  if (waarde === l[veld]) return
  if (veld === 'naam' && (!waarde || waarde.length < 2)) {
    invoer.value = l.naam
    return toon('Geef de leverancier een naam van minstens twee letters.', 'fout')
  }
  try {
    const nieuw = await bron.wijzigLeverancier(l.id, { [veld]: waarde })
    leveranciers.value = opNaam(leveranciers.value.map(x => (x.id === l.id ? nieuw : x)))
    toon('Opgeslagen')
  } catch (e) {
    invoer.value = l[veld] ?? ''
    toon(foutTekst(e), 'fout')
  }
}

/** Op geen project: helemaal weg. Wel op projecten: alleen uit de globale lijst, op die projecten blijft hij staan. */
async function weg(l: Leverancier) {
  const n = projecten(l.id)
  const vraag = n
    ? `${l.naam} uit de globale lijst halen? Op de ${n === 1 ? 'één project' : `${n} projecten`} waar hij al staat, blijft hij staan; op nieuwe projecten kies je hem niet meer.`
    : `${l.naam} uit de globale lijst halen? Hij staat op geen enkel project en is daarna weg.`
  if (!confirm(vraag)) return
  try {
    if (n) await bron.wijzigLeverancier(l.id, { globaal: false })
    else await bron.verwijderLeverancier(l.id)
    leveranciers.value = leveranciers.value.filter(x => x.id !== l.id)
    toon(`${l.naam} staat niet meer in de globale lijst`)
  } catch (e) {
    toon(foutTekst(e), 'fout')
  }
}
</script>

<template>
  <main class="wrap">
    <header class="paginakop">
      <p class="label">Voor alle projecten</p>
      <h1>Instellingen</h1>
    </header>

    <section id="leveranciers" class="blok instellingen">
      <div class="blokkop">
        <div>
          <h2>Leveranciers</h2>
          <p class="klein">De globale lijst. Op een project kies je hieruit onder Details. Een leverancier die alleen bij één project hoort, maak je op dat project zelf aan.</p>
        </div>
      </div>

      <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /><span class="laden-regel" /></div>
      <div v-else-if="stand === 'fout'" class="leeg-staat">{{ fout }} <button type="button" class="link" @click="laad">Probeer het opnieuw</button></div>
      <template v-else>
        <div v-if="leveranciers.length" class="lijst globale-lijst">
          <div class="kolkop"><span>Naam</span><span>Wat ze doen</span><span>Staat op</span><span /></div>
          <div v-for="l in leveranciers" :key="l.id" class="rij">
            <div class="rij-hoofd">
              <input class="veld" :value="l.naam" :aria-label="`Naam van ${l.naam}`" @change="e => wijzig(l, 'naam', e)">
              <input class="veld" :value="l.vak ?? ''" placeholder="Wat ze doen" :aria-label="`Wat ${l.naam} doet`" @change="e => wijzig(l, 'vak', e)">
              <span class="klein">{{ projectenTekst(l.id) }}</span>
              <span class="acties"><button type="button" class="link" @click="weg(l)">Uit de lijst</button></span>
            </div>
          </div>
        </div>
        <div v-else class="leeg-staat">De globale lijst is nog leeg. Voeg hieronder leveranciers toe, of zet er een in de lijst vanaf een project.</div>

        <form class="kaart globale-nieuw" @submit.prevent="voegToe">
          <span class="tab">Nieuwe leverancier</span>
          <input v-model="naam" class="veld" placeholder="Naam, bijvoorbeeld Klimaattechniek Oost" aria-label="Naam van de nieuwe leverancier">
          <input v-model="vak" class="veld" placeholder="Wat ze doen, bijvoorbeeld installateur" aria-label="Wat de nieuwe leverancier doet">
          <button type="submit" class="knop" :disabled="bezig">Toevoegen</button>
        </form>
      </template>
    </section>
    <footer>Projectkaart BbDW</footer>
  </main>
</template>

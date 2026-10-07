<script setup lang="ts">
import type { Project, Taak, Uitzondering, UitzonderingStatus } from '~/lib/types'
import { faseInfo } from '~/lib/fasen'
import { analyseUitzonderingen, KANDIDAAT_MIN_AANDEEL, KANDIDAAT_MIN_PROJECTEN, vaakNvt } from '~/lib/uitzonderingen'

// Over alle projecten: welke uitzonderingen komen zo vaak voor dat ze standaard moeten worden?
useHead({ title: 'Uitzonderingen · Projectkaart' })
const bron = useBron()
const { gebruiker } = useGebruiker()
const { toon } = useToast()
const stand = ref<'laden' | 'klaar' | 'fout'>('laden')
const fout = ref('')
const projecten = ref<Project[]>([])
const taken = ref<Taak[]>([])
const catalogus = ref<Uitzondering[]>([])

onMounted(async () => {
  try {
    ;[projecten.value, taken.value, catalogus.value] = await Promise.all([bron.projecten(), bron.taken(), bron.uitzonderingen()])
    stand.value = 'klaar'
  } catch (e) {
    fout.value = foutTekst(e)
    stand.value = 'fout'
  }
})

const analyse = computed(() => analyseUitzonderingen(catalogus.value, taken.value, projecten.value))
const nvt = computed(() => vaakNvt(taken.value, projecten.value))
const kandidaten = computed(() => analyse.value.filter(a => a.kandidaat && a.uitzondering.status === 'uitzondering').length)
const zin = computed(() => kandidaten.value
  ? `${kandidaten.value} ${kandidaten.value === 1 ? 'uitzondering komt' : 'uitzonderingen komen'} zo vaak voor dat ze misschien in het standaardpakket horen.`
  : 'Geen uitzondering komt vaak genoeg voor om standaard te worden.')

function stand_(a: (typeof analyse.value)[number]) {
  const s = a.uitzondering.status
  if (s === 'standaard') return { licht: 'klaar' as const, woord: 'Standaard' }
  if (s === 'voorgesteld') return { licht: 'nu' as const, woord: 'Voorgesteld' }
  if (a.kandidaat) return { licht: 'letop' as const, woord: 'Kandidaat' }
  return { licht: 'gewoon' as const, woord: 'Uitzondering' }
}
const namen = (ps: Project[]) => ps.length <= 3 ? ps.map(p => p.naam).join(', ') : `${ps.slice(0, 3).map(p => p.naam).join(', ')} en ${ps.length - 3} meer`

async function zetStatus(u: Uitzondering, status: UitzonderingStatus) {
  try {
    await bron.zetUitzonderingStatus(u.id, status)
    u.status = status
    toon(status === 'voorgesteld' ? `${u.titel}: voorgesteld voor het standaardpakket` : status === 'standaard' ? `${u.titel}: staat in het standaardpakket` : `${u.titel}: weer een uitzondering`)
  } catch (e) {
    toon(foutTekst(e), 'fout')
  }
}
</script>

<template>
  <main class="wrap">
    <header class="paginakop">
      <p class="label">Over alle projecten</p>
      <h1>Uitzonderingen</h1>
      <p v-if="stand === 'klaar'" class="zin">{{ zin }}</p>
      <p class="klein regel">Een uitzondering is een kandidaat als hij in minstens {{ KANDIDAAT_MIN_PROJECTEN }} projecten voorkomt, of in minstens {{ Math.round(KANDIDAAT_MIN_AANDEEL * 100) }}% van de projecten die die fase bereikten. Het MT beslist of hij in het standaardpakket komt.</p>
    </header>

    <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /><span class="laden-regel" /></div>
    <div v-else-if="stand === 'fout'" class="leeg-staat">{{ fout }}</div>
    <template v-else>
      <section class="blok analyse">
        <div class="blokkop"><div><h2>De catalogus</h2><p class="klein">Elke uitzondering die in een project is toegevoegd, met hoe vaak hij voorkomt.</p></div></div>
        <div v-if="analyse.length" class="lijst">
          <div class="kolkop"><span>Stand</span><span>Uitzondering</span><span>Fase</span><span>Komt voor in</span><span>Projecten</span><span /></div>
          <div v-for="a in analyse" :key="a.uitzondering.id" class="rij">
            <div class="rij-hoofd">
              <span><StatusTab :licht="stand_(a).licht" :woord="stand_(a).woord" /></span>
              <span class="titel">{{ a.uitzondering.titel }}</span>
              <span>{{ faseInfo(a.uitzondering.fase).naam }}</span>
              <span class="n">{{ a.aantal }} van {{ a.bereikt }}<span class="voortgang"><i :style="{ width: `${Math.round(a.aandeel * 100)}%` }" /></span></span>
              <span class="klein">{{ namen(a.projecten) || '—' }}</span>
              <span v-if="gebruiker?.isMt" class="acties">
                <button v-if="a.uitzondering.status === 'uitzondering'" type="button" class="knop klein" @click="zetStatus(a.uitzondering, 'voorgesteld')">Voorstellen</button>
                <template v-else-if="a.uitzondering.status === 'voorgesteld'">
                  <button type="button" class="knop klein" @click="zetStatus(a.uitzondering, 'standaard')">Opgenomen</button>
                  <button type="button" class="link" @click="zetStatus(a.uitzondering, 'uitzondering')">Terug</button>
                </template>
                <button v-else type="button" class="link" @click="zetStatus(a.uitzondering, 'uitzondering')">Terug naar uitzondering</button>
              </span>
              <span v-else />
            </div>
          </div>
        </div>
        <div v-else class="leeg-staat">Nog geen uitzonderingen. Ze komen erbij zodra iemand er een aan een project toevoegt.</div>
      </section>

      <section class="blok analyse">
        <div class="blokkop"><div><h2>Standaardtaken die vaak n.v.t. zijn</h2><p class="klein">De keerzijde: misschien horen deze niet in het standaardpakket, of alleen bij een bepaalde soort project.</p></div></div>
        <div v-if="nvt.length" class="lijst nvt-lijst">
          <div class="kolkop"><span>Fase</span><span>Standaardtaak</span><span>N.v.t. in</span><span>Redenen</span></div>
          <div v-for="n in nvt" :key="`${n.lijst}:${n.sleutel}`" class="rij">
            <div class="rij-hoofd">
              <span>{{ faseInfo(n.lijst).naam }}</span>
              <span class="titel">{{ n.titel }}</span>
              <span class="n">{{ n.aantal }} van {{ n.bereikt }}<span class="voortgang"><i :style="{ width: `${Math.round(n.aandeel * 100)}%` }" /></span></span>
              <span class="klein">{{ n.redenen.join(' · ') || '—' }}</span>
            </div>
          </div>
        </div>
        <div v-else class="leeg-staat">Geen standaardtaak is in meer dan één project niet van toepassing.</div>
      </section>
    </template>
    <footer>Projectkaart BbDW</footer>
  </main>
</template>

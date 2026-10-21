<script setup lang="ts">
import type { Actie, Adres, Project } from '~/lib/types'
import { actiehouders, alsTekst, herinnering, herinneringAanIedereen, mailLink, openActies, type Actiehouder, type Mail } from '~/lib/actiemail'
import { vandaag } from '~/lib/datum'

// Mail aan actiehouders (zoals in het prototype): per persoon zijn open acties uit het overleg, over alle projecten.
// Een herinnering vóór het overleg en de acties erna. De app opent de mail kant-en-klaar; versturen doe je zelf.
const props = defineProps<{ projecten: Project[] }>()
const emit = defineEmits<{ sluit: [] }>()
const bron = useBron()
const { toon } = useToast()
const { gebruiker } = useGebruiker()
const nu = vandaag()
const stand = ref<'laden' | 'klaar' | 'fout'>('laden')
const acties = ref<Actie[]>([])
const adressen = ref<Adres[]>([])
const VIA_SLEUTEL = 'projectkaart_mail_via'
const via = ref<'web' | 'app'>('web')
try { if (localStorage.getItem(VIA_SLEUTEL) === 'app') via.value = 'app' } catch { /* geen opslag */ }
watch(via, (v) => {
  try { localStorage.setItem(VIA_SLEUTEL, v) } catch { /* geen opslag */ }
})

async function laad() {
  try {
    ;[acties.value, adressen.value] = await Promise.all([bron.acties(), bron.adressen()])
    stand.value = 'klaar'
  } catch (e) {
    toon(foutTekst(e), 'fout')
    stand.value = 'fout'
  }
}
onMounted(laad)

const houders = computed(() => actiehouders(acties.value, props.projecten, nu))
const emailVan = (naam: string) => adressen.value.find(a => a.naam === naam)?.email ?? ''
const metAdres = computed(() => houders.value.filter(h => emailVan(h.naam)))
const afzender = computed(() => gebruiker.value?.naam ?? 'BbDW')
const site = () => location.origin

async function bewaar(naam: string, e: Event) {
  const email = (e.target as HTMLInputElement).value.trim() || null
  if (email === (emailVan(naam) || null)) return
  try {
    await bron.bewaarAdres(naam, email)
    adressen.value = [...adressen.value.filter(a => a.naam !== naam), { naam, email }]
    toon(email ? `E-mailadres van ${naam} bewaard` : `E-mailadres van ${naam} weggehaald`)
  } catch (err) {
    toon(foutTekst(err), 'fout')
  }
}

function open(m: Mail) {
  const a = document.createElement('a')
  a.href = mailLink(m, via.value)
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
const mail = (h: Actiehouder, soort: 'herinnering' | 'acties') =>
  (soort === 'herinnering' ? herinnering : openActies)(h, emailVan(h.naam), afzender.value, site(), nu)
async function kopieer(m: Mail) {
  try {
    await navigator.clipboard.writeText(alsTekst(m))
    toon('Mail gekopieerd · plak hem in een nieuwe mail')
  } catch {
    toon('Kopiëren lukt niet in deze browser.', 'fout')
  }
}
const aanIedereen = () => open(herinneringAanIedereen(metAdres.value.map(h => emailVan(h.naam)), afzender.value, site()))
</script>

<template>
  <section id="mail-actiehouders" class="kaart mail-actiehouders">
    <span class="tab nu">Mail actiehouders</span>
    <div class="mail-kop">
      <p class="klein">
        Per persoon de open acties uit het overleg, over alle projecten. Stuur de <b>herinnering</b> de dag vóór het overleg en de <b>acties</b> erna.
        De mail opent kant-en-klaar; versturen doe je zelf. Een e-mailadres vul je één keer in, voor iedereen.
      </p>
      <div class="mail-keuzes">
        <div class="seg" role="group" aria-label="Mail openen in">
          <button type="button" :aria-pressed="via === 'web'" @click="via = 'web'">Outlook op het web</button>
          <button type="button" :aria-pressed="via === 'app'" @click="via = 'app'">Mailprogramma</button>
        </div>
        <button type="button" class="knop klein" :disabled="!metAdres.length" @click="aanIedereen">Herinnering aan iedereen ({{ metAdres.length }})</button>
        <button type="button" class="link" @click="emit('sluit')">Sluiten</button>
      </div>
    </div>

    <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /></div>
    <div v-else-if="stand === 'fout'" class="leeg-staat">De acties konden niet laden. <button type="button" class="link" @click="laad">Probeer het opnieuw</button></div>
    <p v-else-if="!houders.length" class="leeg-staat">Er zijn geen open acties met een actiehouder. Acties zet je per project onder het tabblad Acties.</p>
    <div v-else class="lijst maillijst">
      <div class="kolkop"><span>Actiehouder</span><span>E-mailadres</span><span>Open acties</span><span>Mail</span></div>
      <div v-for="h in houders" :key="h.naam" class="rij">
        <div class="rij-hoofd">
          <span class="titel">{{ h.naam }}</span>
          <input class="veld" type="email" :value="emailVan(h.naam)" placeholder="naam@bbdw.nl" :aria-label="`E-mailadres ${h.naam}`" @change="e => bewaar(h.naam, e)">
          <span class="klein">
            {{ h.acties.length }} in {{ new Set(h.acties.map(x => x.p.slug)).size }} {{ new Set(h.acties.map(x => x.p.slug)).size === 1 ? 'project' : 'projecten' }}<template v-if="h.teLaat"> · <b class="te-laat">{{ h.teLaat }} te laat</b></template>
          </span>
          <span class="acties">
            <button type="button" class="knop klein" :disabled="!emailVan(h.naam)" :title="emailVan(h.naam) ? 'Vóór het overleg' : 'Vul eerst een e-mailadres in'" @click="open(mail(h, 'herinnering'))">Herinnering</button>
            <button type="button" class="knop klein" :disabled="!emailVan(h.naam)" :title="emailVan(h.naam) ? 'Na het overleg' : 'Vul eerst een e-mailadres in'" @click="open(mail(h, 'acties'))">Acties</button>
            <button type="button" class="link" @click="kopieer(mail(h, 'acties'))">Kopieer</button>
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

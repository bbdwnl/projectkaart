<script setup lang="ts">
import { wisProefbestanden, wisProefgegevens } from '~/data/bron-demo'

const { gebruiker, modus, initialen, uitloggen } = useGebruiker()
const route = useRoute()
const kruimel = useState<{ naam: string, lead: boolean } | null>('kruimel', () => null)
const opKaart = computed(() => !!kruimel.value && route.path.startsWith('/projecten/'))
const menuOpen = ref(false)
const menu = ref<HTMLElement>()
// Op mobiel: één menu met de pagina's, de weergave van de kaart en je account.
const mobielOpen = ref(false)
const mobiel = ref<HTMLElement>()

function sluit(e: MouseEvent) {
  if (menu.value && !menu.value.contains(e.target as Node)) menuOpen.value = false
  if (mobiel.value && !mobiel.value.contains(e.target as Node)) mobielOpen.value = false
}
function toets(e: KeyboardEvent) {
  if (e.key === 'Escape') menuOpen.value = mobielOpen.value = false
}
watch(() => route.path, () => (menuOpen.value = mobielOpen.value = false))
onMounted(() => {
  document.addEventListener('click', sluit)
  document.addEventListener('keydown', toets)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', sluit)
  document.removeEventListener('keydown', toets)
})

/** Proefversie: gooit je eigen wijzigingen weg en laadt de voorbeeldgegevens opnieuw. */
async function opnieuw() {
  wisProefgegevens()
  await wisProefbestanden()
  location.reload()
}
</script>

<template>
  <header class="balk">
    <div class="wrap">
      <NuxtLink class="merk" to="/" aria-label="BbDW Projectkaart">
        <BbdwLogo class="logo" />
        <span class="streep" aria-hidden="true" />
        <b>Projectkaart</b>
      </NuxtLink>
      <nav class="nav" aria-label="Hoofdmenu">
        <NuxtLink to="/">Projecten</NuxtLink>
        <span v-if="opKaart && !kruimel!.lead" class="kruimel" aria-current="page">{{ kruimel!.naam }}</span>
        <NuxtLink to="/leads">Leads</NuxtLink>
        <span v-if="opKaart && kruimel!.lead" class="kruimel" aria-current="page">{{ kruimel!.naam }}</span>
        <NuxtLink to="/controle">Controle</NuxtLink>
        <NuxtLink to="/uitzonderingen">Uitzonderingen</NuxtLink>
      </nav>
      <div class="rechts">
        <span v-if="modus === 'proef'" class="tab later alleen-breed" title="Microsoft is nog niet gekoppeld. Voorbeeldgegevens; je wijzigingen blijven in deze browser.">Proefversie</span>
        <div v-if="gebruiker" ref="menu" class="gebruiker-menu alleen-breed">
          <button type="button" class="avatar" :aria-expanded="menuOpen" aria-haspopup="true" :title="gebruiker.naam" @click="menuOpen = !menuOpen">{{ initialen || '?' }}</button>
          <Transition name="pop">
            <div v-if="menuOpen" class="menu-paneel">
              <b>{{ gebruiker.naam }}</b>
              <span class="klein">{{ gebruiker.email ?? 'Proefversie, zonder account' }}{{ gebruiker.isMt ? ' · MT' : '' }}</span>
              <NuxtLink to="/instellingen" class="link">Instellingen</NuxtLink>
              <button v-if="modus === 'proef'" type="button" class="link" @click="opnieuw">Opnieuw beginnen met de voorbeeldgegevens</button>
              <button type="button" class="link" @click="uitloggen">Uitloggen</button>
            </div>
          </Transition>
        </div>

        <div v-if="gebruiker" ref="mobiel" class="mobiel-menu">
          <button type="button" class="hamburger" :class="{ open: mobielOpen }" :aria-expanded="mobielOpen" aria-controls="mobiel-paneel" aria-label="Menu" @click="mobielOpen = !mobielOpen">
            <i /><i /><i />
          </button>
          <Transition name="pop">
            <div v-if="mobielOpen" id="mobiel-paneel" class="mobiel-paneel">
              <nav class="mm-nav" aria-label="Hoofdmenu">
                <NuxtLink to="/">Projecten</NuxtLink>
                <span v-if="opKaart && !kruimel!.lead" class="mm-kruimel" aria-current="page">{{ kruimel!.naam }}</span>
                <NuxtLink to="/leads">Leads</NuxtLink>
                <span v-if="opKaart && kruimel!.lead" class="mm-kruimel" aria-current="page">{{ kruimel!.naam }}</span>
                <NuxtLink to="/controle">Controle</NuxtLink>
                <NuxtLink to="/uitzonderingen">Uitzonderingen</NuxtLink>
                <NuxtLink to="/instellingen">Instellingen</NuxtLink>
              </nav>
              <section v-if="route.path.startsWith('/projecten/')" class="mm-groep">
                <WeergaveKeuzes />
              </section>
              <section class="mm-groep mm-account">
                <b>{{ gebruiker.naam }}</b>
                <span class="klein">{{ gebruiker.email ?? 'Proefversie, zonder account' }}{{ gebruiker.isMt ? ' · MT' : '' }}</span>
                <span v-if="modus === 'proef'" class="klein">Proefversie: voorbeeldgegevens, je wijzigingen blijven in deze browser.</span>
                <button v-if="modus === 'proef'" type="button" class="link" @click="opnieuw">Opnieuw beginnen met de voorbeeldgegevens</button>
                <button type="button" class="link" @click="uitloggen">Uitloggen</button>
              </section>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </header>
</template>

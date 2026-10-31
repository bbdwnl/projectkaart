<script setup lang="ts">

const { gebruiker, initialen, uitloggen } = useGebruiker()
const route = useRoute()
const kruimel = useState<{ naam: string, groep: 'leads' | 'projecten' } | null>('kruimel', () => null)
/** De projectnaam achter dit menu-item, als je op een kaart bent. */
const kruimelBij = (groep: string) => (kruimel.value && route.path.startsWith('/projecten/') && kruimel.value.groep === groep ? kruimel.value.naam : null)
const MENU = [
  { pad: '/', naam: 'Projecten', groep: 'projecten' },
  { pad: '/leads', naam: 'Acquisitie', groep: 'leads' },
  { pad: '/controle', naam: 'Controle', groep: '' },
  { pad: '/maandmeeting', naam: 'Maand meeting', groep: '' },
]
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
        <template v-for="m in MENU" :key="m.pad">
          <NuxtLink :to="m.pad">{{ m.naam }}</NuxtLink>
          <span v-if="kruimelBij(m.groep)" class="kruimel" aria-current="page">{{ kruimelBij(m.groep) }}</span>
        </template>
      </nav>
      <div class="rechts">
        <div v-if="gebruiker" ref="menu" class="gebruiker-menu alleen-breed">
          <button type="button" class="avatar" :aria-expanded="menuOpen" aria-haspopup="true" :title="gebruiker.naam" @click="menuOpen = !menuOpen">{{ initialen || '?' }}</button>
          <Transition name="pop">
            <div v-if="menuOpen" class="menu-paneel">
              <b>{{ gebruiker.naam }}</b>
              <span class="klein">{{ gebruiker.email }}{{ gebruiker.isMt ? ' · MT' : '' }}</span>
              <NuxtLink to="/instellingen" class="link">Instellingen</NuxtLink>
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
                <template v-for="m in MENU" :key="m.pad">
                  <NuxtLink :to="m.pad">{{ m.naam }}</NuxtLink>
                  <span v-if="kruimelBij(m.groep)" class="mm-kruimel" aria-current="page">{{ kruimelBij(m.groep) }}</span>
                </template>
                <NuxtLink to="/instellingen">Instellingen</NuxtLink>
              </nav>
              <section v-if="route.path.startsWith('/projecten/')" class="mm-groep">
                <WeergaveKeuzes />
              </section>
              <section class="mm-groep mm-account">
                <b>{{ gebruiker.naam }}</b>
                <span class="klein">{{ gebruiker.email }}{{ gebruiker.isMt ? ' · MT' : '' }}</span>
                <button type="button" class="link" @click="uitloggen">Uitloggen</button>
              </section>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </header>
</template>

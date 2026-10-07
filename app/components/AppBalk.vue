<script setup lang="ts">
const { gebruiker, modus, initialen, uitloggen } = useGebruiker()
const route = useRoute()
const kruimel = useState<string | null>('kruimel', () => null)
const menuOpen = ref(false)
const menu = ref<HTMLElement>()

function sluit(e: MouseEvent) {
  if (menu.value && !menu.value.contains(e.target as Node)) menuOpen.value = false
}
onMounted(() => document.addEventListener('click', sluit))
onBeforeUnmount(() => document.removeEventListener('click', sluit))
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
        <span v-if="kruimel && route.path.startsWith('/projecten/')" class="kruimel" aria-current="page">{{ kruimel }}</span>
        <NuxtLink to="/uitzonderingen">Uitzonderingen</NuxtLink>
      </nav>
      <div class="rechts">
        <span v-if="modus === 'demo'" class="tab later" title="Geen backend ingesteld: alles draait in het geheugen met voorbeeldgegevens.">Demo-modus</span>
        <div v-if="gebruiker" ref="menu" class="gebruiker-menu">
          <button type="button" class="avatar" :aria-expanded="menuOpen" aria-haspopup="true" :title="gebruiker.naam" @click="menuOpen = !menuOpen">{{ initialen || '?' }}</button>
          <Transition name="pop">
            <div v-if="menuOpen" class="menu-paneel">
              <b>{{ gebruiker.naam }}</b>
              <span class="klein">{{ gebruiker.email ?? 'Demo-modus' }}{{ gebruiker.isMt ? ' · MT' : '' }}</span>
              <button v-if="modus === 'supabase'" type="button" class="link" @click="uitloggen">Uitloggen</button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </header>
</template>

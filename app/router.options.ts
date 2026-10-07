import type { RouterConfig } from '@nuxt/schema'

// De #hash op een projectkaart kiest een tabblad (#taken, #proces, #details) en is geen anker:
// niet ernaartoe scrollen. Een nieuwe pagina begint bovenaan, terug gaat naar waar je was.
export default <RouterConfig>{
  scrollBehavior(to, from, opgeslagen) {
    if (opgeslagen) return opgeslagen
    if (to.path === from.path) return false
    return { top: 0 }
  },
}

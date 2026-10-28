import { veiligPad } from '~/lib/inlog'

// Alles zit achter de login, behalve /login zelf en de pagina's voor externen (meta extern, met een eigen code).
// Wie nog geen naam heeft opgegeven, doet dat eerst op /login.
export default defineNuxtRouteMiddleware((to) => {
  if (to.meta.extern) return
  const { gebruiker, terugNaInloggen } = useGebruiker()
  if (to.path === '/login') {
    if (gebruiker.value && !gebruiker.value.naamNodig) return navigateTo(typeof to.query.terug === 'string' ? veiligPad(to.query.terug) : terugNaInloggen())
    return
  }
  if (!gebruiker.value || gebruiker.value.naamNodig) return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { terug: to.fullPath } : {} })
})

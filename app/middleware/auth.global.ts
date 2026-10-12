// Alles zit achter de login, behalve /login zelf en de pagina's voor externen (meta extern, met een eigen code).
// In de proefversie is de login een knop zonder account.
export default defineNuxtRouteMiddleware((to) => {
  if (to.meta.extern) return
  const { gebruiker } = useGebruiker()
  if (to.path === '/login') {
    if (gebruiker.value) return navigateTo(typeof to.query.terug === 'string' ? to.query.terug : '/')
    return
  }
  if (!gebruiker.value) return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { terug: to.fullPath } : {} })
})

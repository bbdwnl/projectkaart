// Alles zit achter de login, behalve /login zelf. In de proefversie is de login een knop zonder account.
export default defineNuxtRouteMiddleware((to) => {
  const { gebruiker } = useGebruiker()
  if (to.path === '/login') {
    if (gebruiker.value) return navigateTo(typeof to.query.terug === 'string' ? to.query.terug : '/')
    return
  }
  if (!gebruiker.value) return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { terug: to.fullPath } : {} })
})

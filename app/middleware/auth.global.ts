// Alles zit achter de Microsoft-login, behalve /login zelf. In de demo-modus is iedereen "Demo".
export default defineNuxtRouteMiddleware((to) => {
  const { gebruiker } = useGebruiker()
  if (to.path === '/login') {
    if (gebruiker.value) return navigateTo(typeof to.query.terug === 'string' ? to.query.terug : '/')
    return
  }
  if (!gebruiker.value) return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { terug: to.fullPath } : {} })
})

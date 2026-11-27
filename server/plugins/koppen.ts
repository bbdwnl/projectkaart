import { beveiligingsKoppen, cspVoorPagina } from '../utils/koppen'

// Bij elke pagina die de server maakt (de app is een SPA; Nuxt maakt de pagina per verzoek): de CSP met de hashes van de
// scripts die erin staan, in plaats van 'unsafe-inline' (beslissing 47), en zonder de kop x-powered-by, die alleen
// vertelt welk framework het is. De overige koppen komen uit routeRules (nuxt.config.ts).
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:response', (response) => {
    const headers = (response.headers ??= {})
    for (const k of Object.keys(headers)) if (k.toLowerCase() === 'x-powered-by') delete headers[k]
    if (typeof response.body === 'string') {
      const basis = beveiligingsKoppen(useRuntimeConfig().public.supabaseUrl)['Content-Security-Policy']!
      headers['content-security-policy'] = cspVoorPagina(basis, response.body)
    }
  })
})

import { beveiligingsKoppen } from './server/utils/koppen'

// Beveiligingskoppen voor elk antwoord (server/utils/koppen.ts): CSP, HSTS, geen frames. De Supabase-URL wordt bij het
// bouwen gelezen, zoals de rest van dit bestand. De pagina zelf krijgt zijn CSP met de hashes van de scripts die Nuxt
// erin zet, van server/plugins/koppen.ts; zo is 'unsafe-inline' niet nodig.
const securityHeaders = beveiligingsKoppen(process.env.NUXT_PUBLIC_SUPABASE_URL)

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // Client-side only: the Supabase login session lives in localStorage and
  // every page sits behind the login (a link by e-mail).
  ssr: false,

  // Fonts are self-hosted from npm (no request to Google on page load).
  css: [
    '@fontsource-variable/schibsted-grotesk',
    '~/assets/css/tokens.css',
    '~/assets/css/main.css',
    '~/assets/css/thema-zakelijk.css',
  ],

  app: {
    pageTransition: { name: 'pagina', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'nl' },
      title: 'Projectkaart · BbDW',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#ffffff' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },

  routeRules: {
    '/**': { headers: securityHeaders },
  },

  // Elke nacht om 03:00 UTC een back-up van de database naar de besloten bucket backups (server/api/backup.get.ts).
  // Vercel stuurt CRON_SECRET mee; zonder die variabele in Vercel doet de route niets.
  nitro: {
    vercel: { config: { crons: [{ path: '/api/backup', schedule: '0 3 * * *' }] } },
  },

  runtimeConfig: {
    // De service-sleutel van Supabase (NUXT_SUPABASE_SERVICE_KEY), alleen op de server: daarmee leest
    // server/api/punten de open punten voor de pagina van een leverancier, en maakt server/api/backup de back-up.
    // Leeg = delen en de back-up werken nog niet.
    supabaseServiceKey: '',
    // Het geheim waarmee de server de sessies achter de koppelingen met Copilot versleutelt (NUXT_COPILOT_GEHEIM), alleen
    // op de server, minstens 32 tekens. Leeg = Copilot (/api/mcp, OAuth) werkt nog niet. Zie server/utils/copilot.ts.
    copilotGeheim: '',
    // Extra hosts die als terugadres van Microsoft (Copilot Studio) gelden, met komma's (NUXT_COPILOT_TERUGADRESSEN),
    // bijvoorbeeld .example.microsoft.com. Alleen nodig als Copilot Studio een ander adres gebruikt dan *.consent.azure-apim.net.
    copilotTerugadressen: '',
    public: {
      // Het vaste adres van de app (NUXT_PUBLIC_APP_URL), https://projectkaart.bbdw.nl: de uitgever van
      // de OAuth-tokens voor Copilot. Leeg = het adres waarop het verzoek binnenkomt.
      appUrl: '',
      // Supabase (NUXT_PUBLIC_SUPABASE_URL en _KEY). Verplicht: zonder start de app niet.
      supabaseUrl: '',
      supabaseKey: '',
      // Alleen accounts met dit e-maildomein komen erin (ook afgedwongen in RLS).
      emailDomein: 'bbdw.nl',
    },
  },
})

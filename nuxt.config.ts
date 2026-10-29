// Supabase in the CSP: every project on supabase.co, plus the configured URL when it lives elsewhere (a custom
// domain, or a local `supabase start` on http://127.0.0.1:54321). Read at build time, like the rest of this file.
const supabaseUrl = URL.canParse(process.env.NUXT_PUBLIC_SUPABASE_URL ?? '') ? new URL(process.env.NUXT_PUBLIC_SUPABASE_URL!) : null
const supabase = [...new Set([
  'https://*.supabase.co', 'wss://*.supabase.co',
  ...(supabaseUrl ? [supabaseUrl.origin, `${supabaseUrl.protocol === 'http:' ? 'ws' : 'wss'}://${supabaseUrl.host}`] : []),
])]
const supabaseHttp = supabase.filter(h => h.startsWith('http')).join(' ')

// Security headers for every response. Scripts only from the app itself: Nuxt inlines its config script, so
// 'unsafe-inline' (a strict policy would need nonces), but no other hosts and no eval. The browser only talks
// to the app, Supabase (database, realtime, storage) and PDOK (the BAG lookup); add a host here if that changes.
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseHttp}`,
    "font-src 'self' data:",
    `connect-src 'self' data: blob: ${supabase.join(' ')} https://api.pdok.nl`,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; '),
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
}

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
    public: {
      // Supabase (NUXT_PUBLIC_SUPABASE_URL en _KEY). Verplicht: zonder start de app niet.
      supabaseUrl: '',
      supabaseKey: '',
      // Alleen accounts met dit e-maildomein komen erin (ook afgedwongen in RLS).
      emailDomein: 'bbdw.nl',
    },
  },
})

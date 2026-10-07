// Security headers for every response. No full script CSP: Nuxt inlines its
// payload script, so a strict policy would need nonces.
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // Client-side only: the Supabase login session lives in localStorage and
  // every page sits behind the Microsoft login.
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

  runtimeConfig: {
    public: {
      // Proefversie: Microsoft is nog niet gekoppeld. De inlogknop laat je zonder account
      // binnen en alles draait op voorbeeldgegevens in de browser van de tester.
      // Zet op false (NUXT_PUBLIC_PROEFVERSIE=false) zodra de Microsoft-login werkt.
      proefversie: true,
      // Leeg = ook de proefversie.
      supabaseUrl: '',
      supabaseKey: '',
      // Alleen accounts met dit e-maildomein komen erin (ook afgedwongen in RLS).
      emailDomein: 'bbdw.nl',
    },
  },
})

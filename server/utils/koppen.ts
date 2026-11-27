import { createHash } from 'node:crypto'

// De beveiligingskoppen van de app (beslissingen 35 en 47), voor elk antwoord (routeRules in nuxt.config.ts). De browser
// praat alleen met de app, Supabase (database, realtime, storage) en PDOK (de BAG-lookup); een nieuwe dienst komt hier
// erbij. Scripts alleen van de app zelf: de twee regels script die Nuxt in de pagina zet (de import map en de
// runtime-config) krijgen per antwoord hun hash in de CSP (server/plugins/koppen.ts), zodat 'unsafe-inline' niet nodig
// is en een script dat ergens in de pagina terechtkomt, niet draait.

/** Supabase in de CSP: elk project op supabase.co, plus de ingestelde URL als die ergens anders staat (eigen domein, of een lokale `supabase start`). */
function supabaseHosts(supabaseUrl: string | undefined): string[] {
  const u = URL.canParse(supabaseUrl ?? '') ? new URL(supabaseUrl!) : null
  return [...new Set([
    'https://*.supabase.co', 'wss://*.supabase.co',
    ...(u ? [u.origin, `${u.protocol === 'http:' ? 'ws' : 'wss'}://${u.host}`] : []),
  ])]
}

export function beveiligingsKoppen(supabaseUrl: string | undefined): Record<string, string> {
  const supabase = supabaseHosts(supabaseUrl)
  const supabaseHttp = supabase.filter(h => h.startsWith('http')).join(' ')
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
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
}

/** Een script dat de browser uitvoert: zonder type, of een module, import map of JavaScript. Een blok met gegevens (application/json) niet. */
const VOERT_UIT = /^(module|importmap|speculationrules|text\/javascript|application\/javascript|text\/ecmascript|application\/ecmascript)$/i

/**
 * De hashes ('sha256-…', base64) van de scripts die in de pagina zelf staan: precies wat tussen <script> en </script>
 * staat, zoals de CSP ze vergelijkt. Scripts met src tellen niet (die vallen onder 'self'), blokken met gegevens ook niet.
 */
export function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>()
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = m[1]!
    if (/\ssrc\s*=/i.test(attrs)) continue
    const type = /\stype\s*=\s*["']?([^"'\s>]*)/i.exec(attrs)?.[1]
    if (type && !VOERT_UIT.test(type)) continue
    hashes.add(`'sha256-${createHash('sha256').update(m[2]!, 'utf8').digest('base64')}'`)
  }
  return [...hashes]
}

/** De CSP voor deze pagina: script-src met de hashes van wat erin staat. */
export function cspVoorPagina(csp: string, html: string): string {
  const hashes = inlineScriptHashes(html)
  return csp.split('; ').map(regel => (regel.startsWith('script-src ') && hashes.length ? `${regel} ${hashes.join(' ')}` : regel)).join('; ')
}

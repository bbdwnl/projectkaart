import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { beveiligingsKoppen, cspVoorPagina, inlineScriptHashes } from '../server/utils/koppen'

/** Zoals de browser een inline script hasht voor de CSP: SHA-256 van precies de tekst, in base64. */
const sha = (s: string) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`

describe('beveiligingskoppen', () => {
  it('laat scripts alleen van de app zelf toe: geen unsafe-inline, geen eval, geen frames', () => {
    const koppen = beveiligingsKoppen('https://abc.supabase.co')
    const csp = koppen['Content-Security-Policy']!
    expect(csp).toContain("default-src 'self'; script-src 'self'; style-src")
    expect(csp).not.toMatch(/script-src[^;]*unsafe/)
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(koppen['X-Frame-Options']).toBe('DENY')
    expect(koppen['Strict-Transport-Security']).toContain('max-age=31536000')
    expect(koppen['X-Content-Type-Options']).toBe('nosniff')
  })

  it('neemt Supabase op een eigen adres mee, ook voor realtime (ws), naast *.supabase.co', () => {
    const csp = beveiligingsKoppen('http://127.0.0.1:54321')['Content-Security-Policy']!
    expect(csp).toContain('https://*.supabase.co wss://*.supabase.co http://127.0.0.1:54321 ws://127.0.0.1:54321 https://api.pdok.nl')
    expect(beveiligingsKoppen(undefined)['Content-Security-Policy']).toContain('https://*.supabase.co wss://*.supabase.co https://api.pdok.nl')
    expect(beveiligingsKoppen('geen adres')['Content-Security-Policy']).toContain('https://*.supabase.co wss://*.supabase.co https://api.pdok.nl')
  })

  it('hasht precies de scripts die de browser uitvoert: inline en de import map; niet wat een src heeft of gegevens is', () => {
    const html = `<html><head><script type="importmap">{"imports":{"#entry":"/_nuxt/a.js"}}</script>
      <script type="module" src="/_nuxt/a.js" crossorigin></script>
      <script type="application/json" data-nuxt-data="nuxt-app" data-ssr="false" id="__NUXT_DATA__">[{"serverRendered":1},false]</script>
      <script>window.__NUXT__={};window.__NUXT__.config={public:{}}</script></head><body></body></html>`
    expect(inlineScriptHashes(html)).toEqual([sha('{"imports":{"#entry":"/_nuxt/a.js"}}'), sha('window.__NUXT__={};window.__NUXT__.config={public:{}}')])
    expect(inlineScriptHashes('<p>geen script</p>')).toEqual([])
    expect(inlineScriptHashes('<script>a()</script><script>a()</script>')).toEqual([sha('a()')])
    expect(inlineScriptHashes(`<script type='module'>import "/x.js"</script>`)).toEqual([sha('import "/x.js"')])
  })

  it('zet de hashes in script-src, en laat de rest van de CSP staan', () => {
    const basis = beveiligingsKoppen(undefined)['Content-Security-Policy']!
    const csp = cspVoorPagina(basis, '<script>a()</script>')
    expect(csp).toContain(`script-src 'self' ${sha('a()')}; style-src`)
    expect(csp.replace(` ${sha('a()')}`, '')).toBe(basis)
    expect(cspVoorPagina(basis, '<p>niets</p>')).toBe(basis)
  })
})

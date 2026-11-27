import { createHash } from 'node:crypto'

// De regels van de OAuth-server voor Copilot, zonder Nuxt (getest in tests/copilot.test.ts). OAuth 2.1 met PKCE,
// metadata volgens RFC 8414 en RFC 9728, en registratie van clients volgens RFC 7591 (Copilot Studio en VS Code doen
// dat zelf). De stappen zelf staan in server/utils/oauth.ts.

export const SCOPE = 'projectkaart'
/** Zo lang geldt een autorisatiecode: tussen Toestaan en het ophalen van het token zitten seconden. */
export const CODE_MINUTEN = 5

/** Waar de app staat: de uitgever (issuer), en wat Copilot beschermd vindt (de MCP-server). */
export const resourceVan = (app: string) => `${app}/api/mcp`

/** RFC 9728: welke autorisatieserver bij /api/mcp hoort. */
export const resourceMetadata = (app: string) => ({
  resource: resourceVan(app),
  authorization_servers: [app],
  scopes_supported: [SCOPE],
  bearer_methods_supported: ['header'],
  resource_name: 'Projectkaart BbDW',
})

/** RFC 8414: waar Copilot inlogt, tokens haalt en zich registreert. */
export const serverMetadata = (app: string) => ({
  issuer: app,
  authorization_endpoint: `${app}/koppelen`,
  token_endpoint: `${app}/api/oauth/token`,
  registration_endpoint: `${app}/api/oauth/registreren`,
  scopes_supported: [SCOPE],
  response_types_supported: ['code'],
  response_modes_supported: ['query'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
  authorization_response_iss_parameter_supported: true,
})

let extraHosts: string[] = []
/**
 * Extra hosts die als terugadres van Microsoft gelden, gescheiden door komma's: een precieze host (example.com) of alles
 * eronder (.example.com). Alleen https. Uit NUXT_COPILOT_TERUGADRESSEN, gezet door de server bij elk verzoek.
 */
export function zetExtraTerugadressen(lijst: string | undefined) {
  extraHosts = (lijst ?? '').split(',').map(h => h.trim().toLowerCase()).filter(h => /^\.?[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h))
}

/**
 * Waarheen Copilot na Toestaan terug mag. Alleen bekende plekken, zodat niemand een eigen "client" registreert die een
 * collega via een link laat toestaan en zo zijn token krijgt:
 * - Copilot Studio: de consent-dienst van Power Platform (*.consent.azure-apim.net)
 * - Microsoft 365 Copilot met het eigen app-pakket (map copilot-agent): het vaste terugadres van het Teams Developer
 *   Portal, https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect ("hetzelfde voor elke plugin", Microsoft)
 * - VS Code: vscode.dev, of een poort op deze computer (127.0.0.1 of localhost, RFC 8252)
 * - Wat er in NUXT_COPILOT_TERUGADRESSEN staat (zetExtraTerugadressen): extra hosts van Microsoft, als Copilot Studio
 *   toch een ander adres blijkt te gebruiken. Dan hoeft er geen code te veranderen, alleen die variabele in Vercel.
 * Een geweigerd adres staat in de log van de server (registreer in server/utils/oauth.ts).
 */
export function redirectSoort(uri: string): 'microsoft' | 'vscode' | 'lokaal' | null {
  let u: URL
  try {
    u = new URL(uri)
  } catch {
    return null
  }
  if (u.hash || u.username || u.password) return null
  if (u.protocol === 'https:' && (u.hostname === 'consent.azure-apim.net' || u.hostname.endsWith('.consent.azure-apim.net'))) return 'microsoft'
  if (u.protocol === 'https:' && u.hostname === 'teams.microsoft.com' && u.pathname === '/api/platform/v1.0/oAuthRedirect' && !u.search) return 'microsoft'
  if (u.protocol === 'https:' && extraHosts.some(h => (h.startsWith('.') ? u.hostname.endsWith(h) : u.hostname === h))) return 'microsoft'
  if (u.protocol === 'https:' && ['vscode.dev', 'insiders.vscode.dev'].includes(u.hostname) && u.pathname === '/redirect') return 'vscode'
  if (u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) return 'lokaal'
  return null
}

/** Wat de toestemmingspagina zegt over wie er toegang vraagt: op grond van waar het token heen gaat, niet van wat de client over zichzelf zegt. */
export const SOORT_NAAM = {
  microsoft: 'Microsoft 365 Copilot of Copilot Studio',
  vscode: 'VS Code (GitHub Copilot)',
  lokaal: 'Een programma op deze computer, zoals VS Code',
} as const

/**
 * Redirect-URI's van een lus-adres (127.0.0.1) mogen een andere poort hebben dan bij de registratie (RFC 8252, 7.3);
 * de rest moet precies gelijk zijn.
 */
export function redirectPast(geregistreerd: string[], uri: string): boolean {
  if (geregistreerd.includes(uri)) return true
  if (redirectSoort(uri) !== 'lokaal') return false
  const zonderPoort = (s: string) => {
    const u = new URL(s)
    u.port = ''
    return u.toString()
  }
  return geregistreerd.some(g => redirectSoort(g) === 'lokaal' && zonderPoort(g) === zonderPoort(uri))
}

/** PKCE S256: de verifier hoort bij de challenge van de autorisatie. */
export function pkceKlopt(verifier: unknown, challenge: string): boolean {
  if (typeof verifier !== 'string' || !/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false
  return createHash('sha256').update(verifier, 'ascii').digest('base64url') === challenge
}
export const CHALLENGE_VORM = /^[A-Za-z0-9_-]{43}$/

/** Een registratie volgens RFC 7591, gecontroleerd. Geeft de fout terug als tekst (invalid_redirect_uri of invalid_client_metadata). */
export interface Registratie { naam: string, redirectUris: string[], publiek: boolean }
export function leesRegistratie(body: unknown): Registratie | { fout: 'invalid_redirect_uri' | 'invalid_client_metadata', uitleg: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const uris = b.redirect_uris
  if (!Array.isArray(uris) || !uris.length || uris.length > 10 || !uris.every(u => typeof u === 'string' && u.length <= 2000)) {
    return { fout: 'invalid_redirect_uri', uitleg: 'redirect_uris: een lijst van 1 tot 10 adressen.' }
  }
  const vreemd = (uris as string[]).find(u => !redirectSoort(u))
  if (vreemd) return { fout: 'invalid_redirect_uri', uitleg: `Dit adres mag niet: ${vreemd}. Alleen Copilot Studio (consent.azure-apim.net), vscode.dev of 127.0.0.1.` }
  const methode = b.token_endpoint_auth_method ?? 'client_secret_basic'
  if (!['client_secret_basic', 'client_secret_post', 'none'].includes(methode as string)) {
    return { fout: 'invalid_client_metadata', uitleg: 'token_endpoint_auth_method: client_secret_basic, client_secret_post of none.' }
  }
  for (const [veld, mag] of [['grant_types', ['authorization_code', 'refresh_token']], ['response_types', ['code']]] as const) {
    const v = b[veld]
    if (v !== undefined && (!Array.isArray(v) || !v.every(x => (mag as readonly string[]).includes(x)))) {
      return { fout: 'invalid_client_metadata', uitleg: `${veld}: alleen ${mag.join(', ')}.` }
    }
  }
  const naam = typeof b.client_name === 'string' && b.client_name.trim() ? b.client_name.trim().slice(0, 120) : 'Copilot'
  return { naam, redirectUris: uris as string[], publiek: methode === 'none' }
}

/** Client-id en -geheim uit Authorization: Basic (client_secret_basic) of uit het formulier (client_secret_post). */
export function clientUit(kop: string | undefined | null, form: Record<string, unknown>): { id: string, geheim: string | null } | null {
  const basic = /^Basic\s+(\S+)$/i.exec(kop ?? '')
  if (basic) {
    const tekst = Buffer.from(basic[1]!, 'base64').toString('utf8')
    const i = tekst.indexOf(':')
    try {
      const id = decodeURIComponent(i < 0 ? tekst : tekst.slice(0, i))
      const geheim = i < 0 ? '' : decodeURIComponent(tekst.slice(i + 1))
      return id ? { id, geheim: geheim || null } : null
    } catch {
      return null
    }
  }
  const id = typeof form.client_id === 'string' ? form.client_id : ''
  return id ? { id, geheim: typeof form.client_secret === 'string' && form.client_secret ? form.client_secret : null } : null
}

/** De plek waar Copilot na Toestaan of Weigeren heen gaat, met code of fout, state en de uitgever (RFC 9207). */
export function terugNaar(redirectUri: string, waarden: Record<string, string | undefined>, app: string): string {
  const u = new URL(redirectUri)
  for (const [k, v] of Object.entries({ ...waarden, iss: app })) if (v !== undefined) u.searchParams.set(k, v)
  return u.toString()
}

/** Wie er toegang heeft, voor de lijst onder Instellingen → Copilot: op grond van de redirect-URI's. */
export function soortNaamVan(uris: string[]): string {
  const s = uris.map(redirectSoort).find(x => x !== null)
  return s ? SOORT_NAAM[s] : 'Onbekend programma'
}

/** Het e-mailadres in een access token van Supabase. Alleen voor een token dat de server zelf bewaarde (versleuteld). */
export function emailUitToken(jwt: string): string | null {
  try {
    const email = JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8')).email
    return typeof email === 'string' && email ? email : null
  } catch {
    return null
  }
}

/** De sessie van Supabase in een access token (claim session_id): daaraan herkent de database een koppeling. */
export function sessieIdUitToken(jwt: string): string | null {
  try {
    const id = JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8')).session_id
    return typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id) ? id : null
  } catch {
    return null
  }
}

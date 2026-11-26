import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// Tokens en versleuteling voor de koppeling met Copilot (OAuth, server/utils/oauth.ts). Een token ziet alleen de client
// die het krijgt; de database bewaart er een hash van. De sessie van de medewerker staat versleuteld in de database,
// met een geheim dat alleen op de server staat (NUXT_COPILOT_GEHEIM): wie alleen de database ziet, komt er niet mee binnen.

/** Herkenbare tokens: client-id, client-geheim, autorisatiecode, access token, refresh token. */
export const SOORT = { client: 'pkc_', geheim: 'pks_', code: 'pkg_', toegang: 'pka_', ververs: 'pkr_' } as const
export type TokenSoort = keyof typeof SOORT

/** Het voorvoegsel en 32 willekeurige bytes (43 tekens base64url). */
export const maakToken = (soort: TokenSoort): string => SOORT[soort] + randomBytes(32).toString('base64url')
export const isToken = (soort: TokenSoort, t: unknown): t is string =>
  typeof t === 'string' && t.length === SOORT[soort].length + 43 && t.startsWith(SOORT[soort]) && /^[\w-]+$/.test(t.slice(4))

/** Wat de database van een token bewaart. */
export const hashVan = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex')

/** Het access token uit de kop Authorization: Bearer pka_… Alles wat er niet zo uitziet: null. */
export function toegangUitKop(kop: string | undefined | null): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(kop ?? '')
  return m && isToken('toegang', m[1]) ? m[1]! : null
}

/** Het geheim moet lang genoeg zijn; de AES-sleutel is er de SHA-256 van, zodat elke lengte en vorm werkt. */
export const MIN_GEHEIM = 32
function aesSleutel(geheim: string): Buffer {
  if (geheim.length < MIN_GEHEIM) throw new Error(`NUXT_COPILOT_GEHEIM moet minstens ${MIN_GEHEIM} tekens zijn.`)
  return createHash('sha256').update(geheim, 'utf8').digest()
}

/** AES-256-GCM: v1.<iv>.<tag>.<versleuteld>, alles base64url. */
export function versleutel(tekst: string, geheim: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', aesSleutel(geheim), iv)
  const data = Buffer.concat([c.update(tekst, 'utf8'), c.final()])
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), data.toString('base64url')].join('.')
}

/** Null als het niet klopt: een ander geheim, of iets dat onderweg is veranderd. */
export function ontsleutel(opgeslagen: string, geheim: string): string | null {
  const [v, iv, tag, data] = opgeslagen.split('.')
  if (v !== 'v1' || !iv || !tag || data === undefined) return null
  try {
    const d = createDecipheriv('aes-256-gcm', aesSleutel(geheim), Buffer.from(iv, 'base64url'))
    d.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8')
  } catch {
    return null
  }
}

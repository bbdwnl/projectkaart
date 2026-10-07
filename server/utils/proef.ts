import { createHash, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

// Tijdelijke toegang tot de proefversie met één wachtwoord (NUXT_PROEF_WACHTWOORD).
// Het cookie bevat een afgeleide van het wachtwoord: een nieuw wachtwoord maakt alle cookies ongeldig.

export const PROEF_COOKIE = 'proef_toegang'

export const proefToken = (wachtwoord: string) =>
  createHash('sha256').update(`projectkaart-proef:${wachtwoord}`).digest('hex')

export function gelijk(a: string, b: string): boolean {
  const x = createHash('sha256').update(a).digest()
  const y = createHash('sha256').update(b).digest()
  return timingSafeEqual(x, y)
}

/** Zonder ingesteld wachtwoord is de proefversie open. */
export function heeftProefToegang(event: H3Event): boolean {
  const wachtwoord = useRuntimeConfig(event).proefWachtwoord
  if (!wachtwoord) return true
  const cookie = getCookie(event, PROEF_COOKIE)
  return !!cookie && gelijk(cookie, proefToken(wachtwoord))
}

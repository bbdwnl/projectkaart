import type { H3Event } from 'h3'
import { CHALLENGE_VORM, clientUit, leesRegistratie, pkceKlopt, redirectPast, redirectSoort, SOORT_NAAM, terugNaar } from '../mcp/oauth'
import { hashVan, isToken, maakToken, ontsleutel } from '../mcp/sleutel'
import { appAdres, copilotInstelling, ingelogdeMedewerker, meldAf, nieuweSessie, tokensVoor, type Instelling } from './copilot'

// De OAuth-server voor Copilot (beslissing 46): registreren (RFC 7591), toestaan op /koppelen in de app, en tokens
// (authorization_code met PKCE, refresh_token). De regels staan in server/mcp/oauth.ts, de sessie in copilot.ts.

interface Client { id: string, naam: string, redirect_uris: string[], geheim_hash: string | null }

/** Een fout zoals OAuth hem verwacht (RFC 6749, 5.2): { error, error_description } met de juiste status. */
export class OAuthFout extends Error {
  constructor(public code: string, uitleg: string, public status = 400) {
    super(uitleg)
  }
}
export function oauthAntwoord(event: H3Event, e: unknown) {
  setHeader(event, 'Cache-Control', 'no-store')
  if (e instanceof OAuthFout) {
    setResponseStatus(event, e.status)
    if (e.status === 401) setHeader(event, 'WWW-Authenticate', 'Basic realm="projectkaart"')
    return { error: e.code, error_description: e.message }
  }
  throw e
}

async function client(i: Instelling, id: string): Promise<Client | null> {
  if (!isToken('client', id)) return null
  const res = await i.service.from('oauth_clients').select('id, naam, redirect_uris, geheim_hash').eq('id', id).maybeSingle()
  if (res.error) throw createError({ statusCode: 502, statusMessage: 'De gegevens zijn nu niet bereikbaar.' })
  return res.data as Client | null
}

// ---------------------------------------------------------------------------------------------------------------
// Registreren: Copilot Studio en VS Code melden zich zelf aan
// ---------------------------------------------------------------------------------------------------------------

export async function registreer(event: H3Event) {
  const i = copilotInstelling(event)
  const r = leesRegistratie(await readBody(event).catch(() => null))
  if ('fout' in r) {
    // In de log van Vercel: zo zie je welk terugadres Copilot Studio gebruikt, als het niet in de lijst staat.
    console.warn(`[copilot] registreren geweigerd (${r.fout}): ${r.uitleg}`)
    throw new OAuthFout(r.fout, r.uitleg)
  }
  const id = maakToken('client')
  const geheim = r.publiek ? null : maakToken('geheim')
  const res = await i.service.from('oauth_clients').insert({ id, naam: r.naam, redirect_uris: r.redirectUris, geheim_hash: geheim ? hashVan(geheim) : null })
  if (res.error) throw new OAuthFout('temporarily_unavailable', res.error.code === 'P0001' ? res.error.message : 'Registreren lukte niet.', 503)
  console.info(`[copilot] nieuwe client ${r.naam}: ${r.redirectUris.join(', ')}`)
  setResponseStatus(event, 201)
  setHeader(event, 'Cache-Control', 'no-store')
  return {
    client_id: id,
    ...(geheim ? { client_secret: geheim, client_secret_expires_at: 0 } : {}),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: r.naam,
    redirect_uris: r.redirectUris,
    token_endpoint_auth_method: r.publiek ? 'none' : 'client_secret_post',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Toestaan, op de pagina /koppelen (met de inlog van de browser)
// ---------------------------------------------------------------------------------------------------------------

/** Wat de pagina toont: wie er vraagt. Een onbekende client of een vreemd adres: geen doorsturen, alleen een melding. */
export async function clientVoorPagina(event: H3Event, id: unknown, redirectUri: unknown) {
  const c = typeof id === 'string' ? await client(copilotInstelling(event), id) : null
  if (!c || typeof redirectUri !== 'string' || !redirectPast(c.redirect_uris, redirectUri)) {
    throw createError({ statusCode: 400, statusMessage: 'Deze koppeling klopt niet: onbekende client of een ander terugadres. Begin opnieuw vanuit Copilot.' })
  }
  const soort = redirectSoort(redirectUri)!
  return { naam: c.naam, soort: SOORT_NAAM[soort], adres: new URL(redirectUri).host }
}

export interface Toestemming { client_id?: unknown, redirect_uri?: unknown, response_type?: unknown, code_challenge?: unknown, code_challenge_method?: unknown, state?: unknown, toestaan?: unknown }

/** Toestaan of weigeren. Geeft het adres terug waar de browser heen gaat (terug naar Copilot). */
export async function geefToestemming(event: H3Event, t: Toestemming): Promise<{ url: string }> {
  const i = await ingelogdeMedewerker(event)
  await clientVoorPagina(event, t.client_id, t.redirect_uri)
  const redirect = t.redirect_uri as string
  const app = appAdres(event)
  const state = typeof t.state === 'string' ? t.state : undefined
  if (t.toestaan !== true) return { url: terugNaar(redirect, { error: 'access_denied', error_description: 'De medewerker weigerde.', state }, app) }
  if (t.response_type !== 'code') return { url: terugNaar(redirect, { error: 'unsupported_response_type', error_description: 'Alleen response_type=code.', state }, app) }
  if (t.code_challenge_method !== 'S256' || typeof t.code_challenge !== 'string' || !CHALLENGE_VORM.test(t.code_challenge)) {
    return { url: terugNaar(redirect, { error: 'invalid_request', error_description: 'PKCE (S256) is verplicht.', state }, app) }
  }
  const code = maakToken('code')
  const res = await i.service.from('oauth_codes').insert({
    hash: hashVan(code), client_id: t.client_id, gebruiker_id: i.gebruiker.id, redirect_uri: redirect, code_challenge: t.code_challenge,
  })
  if (res.error) throw createError({ statusCode: 502, statusMessage: 'Toestaan lukte niet. Probeer het opnieuw.' })
  return { url: terugNaar(redirect, { code, state }, app) }
}

// ---------------------------------------------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------------------------------------------

/** De client bewijst zich: met zijn geheim, of (publiek, zoals VS Code) alleen met PKCE. */
async function bewezenClient(event: H3Event, i: Instelling, form: Record<string, unknown>): Promise<Client> {
  const opgave = clientUit(getHeader(event, 'authorization'), form)
  const c = opgave ? await client(i, opgave.id) : null
  if (!c || (c.geheim_hash && (!opgave!.geheim || hashVan(opgave!.geheim) !== c.geheim_hash))) {
    throw new OAuthFout('invalid_client', 'Onbekende client of verkeerd geheim.', 401)
  }
  return c
}

export async function geefToken(event: H3Event) {
  const i = copilotInstelling(event)
  const form = ((await readBody(event).catch(() => null)) ?? {}) as Record<string, unknown>
  const c = await bewezenClient(event, i, form)
  if (form.grant_type === 'authorization_code') return metCode(i, c, form)
  if (form.grant_type === 'refresh_token') return metVerversing(i, c, form)
  throw new OAuthFout('unsupported_grant_type', 'Alleen authorization_code en refresh_token.')
}

async function metCode(i: Instelling, c: Client, form: Record<string, unknown>) {
  const ongeldig = () => new OAuthFout('invalid_grant', 'De code is onbekend, al gebruikt of verlopen. Begin opnieuw.')
  if (!isToken('code', form.code)) throw ongeldig()
  // Ophalen en weghalen in één keer: een code werkt maar één keer.
  const res = await i.service.from('oauth_codes').delete().eq('hash', hashVan(form.code)).select('client_id, gebruiker_id, redirect_uri, code_challenge, verloopt_op').maybeSingle()
  const code = res.data as { client_id: string, gebruiker_id: string, redirect_uri: string, code_challenge: string, verloopt_op: string } | null
  if (res.error || !code || code.client_id !== c.id || Date.parse(code.verloopt_op) <= Date.now()) throw ongeldig()
  if (form.redirect_uri !== code.redirect_uri) throw new OAuthFout('invalid_grant', 'redirect_uri hoort niet bij deze code.')
  if (!pkceKlopt(form.code_verifier, code.code_challenge)) throw new OAuthFout('invalid_grant', 'code_verifier hoort niet bij deze code (PKCE).')

  const user = (await i.service.auth.admin.getUserById(code.gebruiker_id)).data.user
  if (!user?.email) throw ongeldig()
  const sessie = await nieuweSessie(i, user.email)
  const t = tokensVoor(i, sessie)
  const nieuw = await i.service.from('copilot_koppelingen').insert({ gebruiker_id: code.gebruiker_id, client_id: c.id, ...t.rij })
  if (nieuw.error) {
    await i.service.auth.admin.signOut(sessie.access_token, 'local').catch(() => null)
    throw new OAuthFout('invalid_grant', nieuw.error.code === 'P0001' ? nieuw.error.message : 'De koppeling opslaan lukte niet.')
  }
  return t.antwoord
}

async function metVerversing(i: Instelling, c: Client, form: Record<string, unknown>) {
  const ongeldig = () => new OAuthFout('invalid_grant', 'De koppeling is verlopen of ingetrokken. Log opnieuw in.')
  if (!isToken('ververs', form.refresh_token)) throw ongeldig()
  const oud = hashVan(form.refresh_token)
  const res = await i.service.from('copilot_koppelingen').select('id, client_id, sessie, toegang, geldig_tot, ingetrokken_op').eq('ververs_hash', oud).maybeSingle()
  const rij = res.data as { id: string, client_id: string, sessie: string | null, toegang: string | null, geldig_tot: string, ingetrokken_op: string | null } | null
  if (res.error || !rij || rij.client_id !== c.id || rij.ingetrokken_op || !rij.sessie || Date.parse(rij.geldig_tot) <= Date.now()) throw ongeldig()

  // Het refresh token werkt één keer: eerst opeisen, zodat twee verzoeken tegelijk niet allebei verder komen.
  const tussen = maakToken('ververs')
  const opgeeist = await i.service.from('copilot_koppelingen').update({ ververs_hash: hashVan(tussen) }).eq('id', rij.id).eq('ververs_hash', oud).select('id')
  if (opgeeist.error || !opgeeist.data?.length) throw ongeldig()

  const ververs = ontsleutel(rij.sessie, i.geheim)
  const sessie = ververs ? (await i.anon().auth.refreshSession({ refresh_token: ververs })).data.session : null
  if (!sessie) {
    // De sessie bij Supabase is weg (uitgelogd, of de week is om): deze koppeling is klaar.
    await i.service.from('copilot_koppelingen').update({ ingetrokken_op: new Date().toISOString() }).eq('id', rij.id)
    throw ongeldig()
  }
  const t = tokensVoor(i, sessie)
  const bijgewerkt = await i.service.from('copilot_koppelingen').update(t.rij).eq('id', rij.id).is('ingetrokken_op', null).select('id')
  if (bijgewerkt.error || !bijgewerkt.data?.length) {
    await meldAf(i, t.rij.toegang)
    throw ongeldig()
  }
  return t.antwoord
}

import type { H3Event } from 'h3'
import { CHALLENGE_VORM, clientUit, leesRegistratie, pkceKlopt, redirectPast, redirectSoort, sessieIdUitToken, SOORT_NAAM, soortNaamVan, terugNaar } from '../mcp/oauth'
import { hashVan, isToken, maakToken, ontsleutel } from '../mcp/sleutel'
import { appAdres, copilotInstelling, ingelogdeMedewerker, meldAf, nieuweSessie, tokensVoor, type Instelling } from './copilot'

// De OAuth-server voor Copilot (beslissing 46): registreren (RFC 7591), goedkeuren door het MT (beslissing 47), toestaan
// op /koppelen in de app, en tokens (authorization_code met PKCE, refresh_token). De regels staan in server/mcp/oauth.ts,
// de sessie in copilot.ts.

interface Client { id: string, naam: string, redirect_uris: string[], geheim_hash: string | null, goedgekeurd_op: string | null }

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
  const res = await i.service.from('oauth_clients').select('id, naam, redirect_uris, geheim_hash, goedgekeurd_op').eq('id', id).maybeSingle()
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
// Goedkeuren door het MT (beslissing 47): een programma mag pas koppelen als iemand van het MT het goedkeurde
// ---------------------------------------------------------------------------------------------------------------
// Registreren staat open (zo werkt het protocol), en een terugadres bij Microsoft is niet per se dat van BbDW. Zonder
// goedkeuring geeft de database geen autorisatiecode (trigger oauth_code_maken), dus ook geen token.

export const NIET_GOEDGEKEURD = 'Dit programma is nog niet goedgekeurd door het MT. Vraag iemand van het MT het goed te keuren onder Instellingen → Copilot, en begin dan opnieuw vanuit Copilot.'

type Ingelogd = Awaited<ReturnType<typeof ingelogdeMedewerker>>
function alleenMt(i: Ingelogd) {
  if (!i.gebruiker.isMt) throw createError({ statusCode: 403, statusMessage: 'Alleen het MT beheert welke programma\'s mogen koppelen.' })
}

/** Goedkeuren namens deze MT'er. Al goedgekeurd: dan is er niets te doen. */
async function keurGoed(i: Instelling, id: string, door: string) {
  const c = await client(i, id)
  if (!c) throw createError({ statusCode: 404, statusMessage: 'Dit programma bestaat niet (meer).' })
  if (c.goedgekeurd_op) return
  const res = await i.service.from('oauth_clients').update({ goedgekeurd_op: new Date().toISOString(), goedgekeurd_door: door }).eq('id', id).is('goedgekeurd_op', null)
  // P0001: de database weigert (geen MT); die melding is voor het scherm.
  if (res.error) throw createError({ statusCode: res.error.code === 'P0001' ? 403 : 502, statusMessage: res.error.code === 'P0001' ? res.error.message : 'Goedkeuren lukte niet.' })
  console.info(`[copilot] client ${c.naam} (${id}) goedgekeurd door het MT`)
}

export interface ClientInfo { id: string, naam: string, soort: string, adressen: string[], aangemaakt_op: string, goedgekeurd_op: string | null, goedgekeurd_door: string | null, koppelingen: number }
const hostVan = (uri: string) => {
  try {
    return new URL(uri).host
  } catch {
    return uri
  }
}

/** Voor Instellingen → Copilot (MT): alle programma's die zich meldden, wie ze goedkeurde en hoeveel collega's eraan gekoppeld zijn. */
export async function alleClients(event: H3Event): Promise<ClientInfo[]> {
  const i = await ingelogdeMedewerker(event)
  alleenMt(i)
  const [clients, koppelingen] = await Promise.all([
    i.service.from('oauth_clients').select('id, naam, redirect_uris, aangemaakt_op, goedgekeurd_op, goedgekeurd_door').order('aangemaakt_op', { ascending: false }),
    i.service.from('copilot_koppelingen').select('client_id').is('ingetrokken_op', null).gt('geldig_tot', new Date().toISOString()),
  ])
  if (clients.error || koppelingen.error) throw createError({ statusCode: 502, statusMessage: 'De programma\'s laden lukte niet.' })
  const rijen = clients.data as { id: string, naam: string, redirect_uris: string[], aangemaakt_op: string, goedgekeurd_op: string | null, goedgekeurd_door: string | null }[]
  const door = [...new Set(rijen.map(r => r.goedgekeurd_door).filter((x): x is string => !!x))]
  const profielen = door.length ? ((await i.service.from('profielen').select('id, naam, email').in('id', door)).data ?? []) as { id: string, naam: string | null, email: string }[] : []
  const naamVan = new Map(profielen.map(p => [p.id, p.naam?.trim() || p.email]))
  const aantal = new Map<string, number>()
  for (const k of koppelingen.data as { client_id: string }[]) aantal.set(k.client_id, (aantal.get(k.client_id) ?? 0) + 1)
  return rijen.map(r => ({
    id: r.id,
    naam: r.naam,
    soort: soortNaamVan(r.redirect_uris),
    adressen: [...new Set(r.redirect_uris.map(hostVan))],
    aangemaakt_op: r.aangemaakt_op,
    goedgekeurd_op: r.goedgekeurd_op,
    goedgekeurd_door: r.goedgekeurd_op ? (r.goedgekeurd_door && naamVan.get(r.goedgekeurd_door)) || 'een oud-collega' : null,
    koppelingen: aantal.get(r.id) ?? 0,
  }))
}

/** Goedkeuren vanuit Instellingen → Copilot (MT). Daarna kan elke collega het programma toestaan op /koppelen. */
export async function keurClientGoed(event: H3Event, id: string) {
  const i = await ingelogdeMedewerker(event)
  alleenMt(i)
  await keurGoed(i, id, i.gebruiker.id)
}

/**
 * Weghalen (MT): weigeren wat zich meldde, of intrekken wat was goedgekeurd. De koppelingen van alle collega's eraan
 * stoppen meteen (de rijen gaan mee), en de sessies erachter worden zo goed als het gaat uitgelogd.
 */
export async function verwijderClient(event: H3Event, id: string) {
  const i = await ingelogdeMedewerker(event)
  alleenMt(i)
  const c = await client(i, id)
  if (!c) throw createError({ statusCode: 404, statusMessage: 'Dit programma bestaat niet (meer).' })
  const sessies = await i.service.from('copilot_koppelingen').select('toegang').eq('client_id', id).is('ingetrokken_op', null)
  for (const s of (sessies.data ?? []) as { toegang: string | null }[]) await meldAf(i, s.toegang)
  const weg = await i.service.from('oauth_clients').delete().eq('id', id)
  if (weg.error) throw createError({ statusCode: 502, statusMessage: 'Weghalen lukte niet.' })
  console.info(`[copilot] client ${c.naam} (${id}) weggehaald door het MT`)
}

// ---------------------------------------------------------------------------------------------------------------
// Toestaan, op de pagina /koppelen (met de inlog van de browser)
// ---------------------------------------------------------------------------------------------------------------

/** Wat de pagina toont: wie er vraagt, en of het MT het al goedkeurde. Een onbekende client of een vreemd adres: geen doorsturen, alleen een melding. */
export async function clientVoorPagina(event: H3Event, id: unknown, redirectUri: unknown) {
  const c = typeof id === 'string' ? await client(copilotInstelling(event), id) : null
  if (!c || typeof redirectUri !== 'string' || !redirectPast(c.redirect_uris, redirectUri)) {
    throw createError({ statusCode: 400, statusMessage: 'Deze koppeling klopt niet: onbekende client of een ander terugadres. Begin opnieuw vanuit Copilot.' })
  }
  const soort = redirectSoort(redirectUri)!
  return { naam: c.naam, soort: SOORT_NAAM[soort], adres: new URL(redirectUri).host, goedgekeurd: !!c.goedgekeurd_op }
}

export interface Toestemming { client_id?: unknown, redirect_uri?: unknown, response_type?: unknown, code_challenge?: unknown, code_challenge_method?: unknown, state?: unknown, toestaan?: unknown, goedkeuren?: unknown }

/** Toestaan of weigeren. Geeft het adres terug waar de browser heen gaat (terug naar Copilot). */
export async function geefToestemming(event: H3Event, t: Toestemming): Promise<{ url: string }> {
  const i = await ingelogdeMedewerker(event)
  const c = await clientVoorPagina(event, t.client_id, t.redirect_uri)
  const redirect = t.redirect_uri as string
  const app = appAdres(event)
  const state = typeof t.state === 'string' ? t.state : undefined
  if (t.toestaan !== true) return { url: terugNaar(redirect, { error: 'access_denied', error_description: 'De medewerker weigerde.', state }, app) }
  if (!c.goedgekeurd) {
    // Een nieuw programma: alleen iemand van het MT keurt het goed, en zegt dat er uitdrukkelijk bij (de pagina vraagt het).
    if (t.goedkeuren !== true || !i.gebruiker.isMt) throw createError({ statusCode: 403, statusMessage: NIET_GOEDGEKEURD })
    await keurGoed(i, t.client_id as string, i.gebruiker.id)
  }
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
  const nieuw = await i.service.from('copilot_koppelingen')
    .insert({ gebruiker_id: code.gebruiker_id, client_id: c.id, sessie_id: sessieIdUitToken(sessie.access_token), ...t.rij })
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

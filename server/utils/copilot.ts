import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import type { Bron } from '../../app/data/bron'
import { maakSupabaseBron } from '../../app/data/bron-supabase'
import { emailUitToken, resourceVan, SCOPE, soortNaamVan, zetExtraTerugadressen } from '../mcp/oauth'
import { hashVan, maakToken, ontsleutel, toegangUitKop, versleutel } from '../mcp/sleutel'

// Copilot werkt namens een medewerker, met een eigen inlogsessie van die medewerker (geen eigen rechten). Die sessie
// begint als de medewerker de koppeling toestaat (server/utils/oauth.ts): de server logt dan voor hem in, zoals een link
// per mail doet (dezelfde week, dezelfde RLS), en bewaart de sessie versleuteld. Copilot krijgt eigen tokens (een access
// token van een uur en een refresh token); bij elk verzoek zoekt de server de koppeling op en praat met de database als
// die medewerker. Wie, wanneer en het logboek komen zo van de database, net als in de app.

export interface CopilotGebruiker { id: string, naam: string, email: string, isMt: boolean }
export interface CopilotSessie { bron: Bron, gebruiker: CopilotGebruiker, geldigTot: string }

export const ZONDER_OPSLAG = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
/** Hoogstens zo lang geldt een access token van Copilot; nooit langer dan het token van Supabase erachter. */
const TOEGANG_SECONDEN = 3600

export function copilotInstelling(event: H3Event) {
  const config = useRuntimeConfig(event)
  const { supabaseUrl: url, supabaseKey: publiek } = config.public
  if (!url || !publiek || !config.supabaseServiceKey || !config.copilotGeheim) {
    throw createError({ statusCode: 503, statusMessage: 'Copilot is nog niet ingesteld op de server (NUXT_COPILOT_GEHEIM en NUXT_SUPABASE_SERVICE_KEY).' })
  }
  zetExtraTerugadressen(config.copilotTerugadressen)
  return {
    url,
    publiek,
    geheim: config.copilotGeheim,
    service: createClient(url, config.supabaseServiceKey, ZONDER_OPSLAG),
    anon: () => createClient(url, publiek, ZONDER_OPSLAG),
  }
}
export type Instelling = ReturnType<typeof copilotInstelling>

/**
 * Het adres van de app: de uitgever van de tokens en het adres van de MCP-server. NUXT_PUBLIC_APP_URL als die er is
 * (zet hem in productie, zodat het altijd hetzelfde adres is), anders het adres waarop het verzoek binnenkwam.
 */
export function appAdres(event: H3Event): string {
  const vast = useRuntimeConfig(event).public.appUrl
  if (vast) return vast.replace(/\/+$/, '')
  return getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
}

/** De database als deze medewerker: RLS en wie() zoals in de browser. */
export const alsGebruiker = (i: Instelling, token: string): SupabaseClient =>
  createClient(i.url, i.publiek, { ...ZONDER_OPSLAG, global: { headers: { Authorization: `Bearer ${token}` } } })

/** Naam en rol uit het profiel, zoals wie() ze leest. Null als de database deze inlog niet (meer) toelaat. */
export async function profiel(sb: SupabaseClient, id: string, email: string): Promise<CopilotGebruiker | null> {
  const [mag, p] = await Promise.all([sb.rpc('is_medewerker'), sb.from('profielen').select('naam, rol').eq('id', id).maybeSingle()])
  if (mag.data !== true || p.error) return null
  return { id, email, naam: p.data?.naam?.trim() || email, isMt: p.data?.rol === 'mt' }
}

/** Een nieuwe sessie voor deze medewerker, zoals een link per mail die geeft (amr otp, een week geldig). */
export async function nieuweSessie(i: Instelling, email: string): Promise<Session> {
  const link = await i.service.auth.admin.generateLink({ type: 'magiclink', email })
  const otp = link.data?.properties?.email_otp
  const login = otp ? await i.anon().auth.verifyOtp({ email, token: otp, type: 'email' }) : null
  if (!login?.data.session) throw createError({ statusCode: 502, statusMessage: 'Inloggen voor Copilot lukte niet.' })
  return login.data.session
}

/** Nieuwe tokens voor Copilot bij deze sessie: wat in de rij komt, en wat Copilot terugkrijgt. */
export function tokensVoor(i: Instelling, sessie: Session) {
  const toegang = maakToken('toegang')
  const ververs = maakToken('ververs')
  const seconden = Math.max(60, Math.min(TOEGANG_SECONDEN, (sessie.expires_at ?? 0) - Math.floor(Date.now() / 1000) - 60))
  return {
    rij: {
      sessie: versleutel(sessie.refresh_token, i.geheim),
      toegang: versleutel(sessie.access_token, i.geheim),
      toegang_hash: hashVan(toegang),
      toegang_tot: new Date(Date.now() + seconden * 1000).toISOString(),
      ververs_hash: hashVan(ververs),
      laatst_gebruikt_op: new Date().toISOString(),
    },
    antwoord: { access_token: toegang, token_type: 'Bearer', expires_in: seconden, refresh_token: ververs, scope: SCOPE },
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Een verzoek van Copilot (/api/mcp)
// ---------------------------------------------------------------------------------------------------------------

/** 401 met de verwijzing naar de OAuth-gegevens (RFC 9728), zodat Copilot weet waar het moet inloggen. */
function nietIngelogd(event: H3Event, fout: string | null, tekst: string) {
  const metadata = `${appAdres(event)}/.well-known/oauth-protected-resource${new URL(resourceVan(appAdres(event))).pathname}`
  setHeader(event, 'WWW-Authenticate', `Bearer resource_metadata="${metadata}", scope="${SCOPE}"${fout ? `, error="${fout}"` : ''}`)
  return createError({ statusCode: 401, statusMessage: tekst })
}

/** De medewerker achter het access token in Authorization: Bearer pka_…; anders 401. */
export async function copilotSessie(event: H3Event): Promise<CopilotSessie> {
  const kop = getHeader(event, 'authorization')
  const token = toegangUitKop(kop)
  if (!token) throw nietIngelogd(event, kop ? 'invalid_token' : null, 'Log in bij de Projectkaart (OAuth).')
  const i = copilotInstelling(event)

  // Elk verzoek leest de koppeling: intrekken werkt meteen.
  const res = await i.service.from('copilot_koppelingen')
    .select('id, gebruiker_id, toegang, toegang_tot, geldig_tot, ingetrokken_op, laatst_gebruikt_op')
    .eq('toegang_hash', hashVan(token)).maybeSingle()
  if (res.error) throw createError({ statusCode: 502, statusMessage: 'De gegevens zijn nu niet bereikbaar.' })
  const rij = res.data as { id: string, gebruiker_id: string, toegang: string | null, toegang_tot: string | null, geldig_tot: string, ingetrokken_op: string | null, laatst_gebruikt_op: string | null } | null
  const nu = Date.now()
  const supabase = rij && !rij.ingetrokken_op && rij.toegang && Date.parse(rij.toegang_tot ?? '') > nu && Date.parse(rij.geldig_tot) > nu
    ? ontsleutel(rij.toegang, i.geheim)
    : null
  if (!rij || !supabase) throw nietIngelogd(event, 'invalid_token', 'Deze koppeling is verlopen of ingetrokken. Log opnieuw in.')

  const sb = alsGebruiker(i, supabase)
  const email = emailUitToken(supabase)
  const gebruiker = email ? await profiel(sb, rij.gebruiker_id, email) : null
  if (!gebruiker) throw nietIngelogd(event, 'invalid_token', 'Deze koppeling is verlopen. Log opnieuw in.')
  if (!rij.laatst_gebruikt_op || nu - Date.parse(rij.laatst_gebruikt_op) > 5 * 60_000) {
    await i.service.from('copilot_koppelingen').update({ laatst_gebruikt_op: new Date().toISOString() }).eq('id', rij.id)
  }
  return { bron: maakSupabaseBron(sb), gebruiker, geldigTot: rij.geldig_tot }
}

// ---------------------------------------------------------------------------------------------------------------
// Vanuit de app, met de inlog van de browser: toestaan (oauth.ts) en de koppelingen beheren
// ---------------------------------------------------------------------------------------------------------------

/** De ingelogde medewerker achter het token van de browser (Authorization: Bearer <access token van Supabase>). */
export async function ingelogdeMedewerker(event: H3Event) {
  const i = copilotInstelling(event)
  const token = /^Bearer\s+(\S+)$/i.exec(getHeader(event, 'authorization') ?? '')?.[1]
  const user = token ? (await i.service.auth.getUser(token)).data.user : null
  const gebruiker = token && user?.email ? await profiel(alsGebruiker(i, token), user.id, user.email) : null
  if (!gebruiker) throw createError({ statusCode: 401, statusMessage: 'Log opnieuw in.' })
  return { ...i, gebruiker }
}

export interface KoppelingInfo { id: string, client: string, soort: string, geldig_tot: string, laatst_gebruikt_op: string | null, aangemaakt_op: string }

export async function mijnKoppelingen(event: H3Event): Promise<KoppelingInfo[]> {
  const { service, gebruiker } = await ingelogdeMedewerker(event)
  const res = await service.from('copilot_koppelingen')
    .select('id, geldig_tot, laatst_gebruikt_op, aangemaakt_op, client:oauth_clients(naam, redirect_uris)')
    .eq('gebruiker_id', gebruiker.id).is('ingetrokken_op', null).gt('geldig_tot', new Date().toISOString())
    .order('aangemaakt_op', { ascending: false })
  if (res.error) throw createError({ statusCode: 502, statusMessage: 'De koppelingen laden lukte niet.' })
  return (res.data as unknown as { id: string, geldig_tot: string, laatst_gebruikt_op: string | null, aangemaakt_op: string, client: { naam: string, redirect_uris: string[] } | null }[])
    .map(({ client, ...k }) => ({ ...k, client: client?.naam ?? 'Copilot', soort: soortNaamVan(client?.redirect_uris ?? []) }))
}

/** Intrekken: Copilot kan er meteen niets meer mee, en de sessie erachter wordt uitgelogd. */
export async function trekKoppelingIn(event: H3Event, id: string): Promise<void> {
  const i = await ingelogdeMedewerker(event)
  const res = await i.service.from('copilot_koppelingen').select('id, toegang').eq('id', id).eq('gebruiker_id', i.gebruiker.id).is('ingetrokken_op', null).maybeSingle()
  if (res.error) throw createError({ statusCode: 502, statusMessage: 'Intrekken lukte niet.' })
  if (!res.data) throw createError({ statusCode: 404, statusMessage: 'Deze koppeling bestaat niet (meer).' })
  // Eerst intrekken (de trigger haalt sessie en tokens weg), dan zo goed als het gaat uitloggen.
  const weg = await i.service.from('copilot_koppelingen').update({ ingetrokken_op: new Date().toISOString() }).eq('id', id)
  if (weg.error) throw createError({ statusCode: 502, statusMessage: 'Intrekken lukte niet.' })
  await meldAf(i, res.data.toegang)
}

/** De sessie van Supabase uitloggen, als het access token nog geldt. Lukt het niet, dan verloopt hij vanzelf. */
export async function meldAf(i: Instelling, versleuteld: string | null) {
  const token = versleuteld ? ontsleutel(versleuteld, i.geheim) : null
  if (token) await i.service.auth.admin.signOut(token, 'local').catch(() => null)
}

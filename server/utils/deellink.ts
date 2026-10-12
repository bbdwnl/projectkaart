import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import type { Deellink } from '../../app/lib/types'
import { controleerCode, dichtAntwoord, standVan, TOKEN_VORM, type ExternAntwoord, type ExternInhoud, type Meldingen } from '../../app/lib/deellink'

// De pagina van een leverancier (/punten/<token>) heeft geen account: de server leest voor hem, met de
// service-rol, en geeft alleen wat bij de link hoort. Elke vraag controleert de link en de code opnieuw.

/** De database met de service-rol. Alleen op de server; de sleutel komt nooit in de browser. */
export function serviceDatabase(event: H3Event): SupabaseClient {
  const config = useRuntimeConfig(event)
  if (!config.public.supabaseUrl || !config.supabaseServiceKey) {
    throw createError({ statusCode: 503, statusMessage: 'Delen met leveranciers is nog niet ingesteld.' })
  }
  return createClient(config.public.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export const nietBereikbaar = () => createError({ statusCode: 502, statusMessage: 'De gegevens zijn nu niet bereikbaar.' })

type LinkVelden = Pick<Deellink, 'token' | 'code' | 'geldig_tot' | 'gesloten_reden' | 'gesloten_op' | 'foute_pogingen'>
/** Een link in de proefversie: een kopie uit de browser van een tester (tabel proef_deellinks). */
export type ProefRij = LinkVelden & Pick<Deellink, 'bekeken_op'> & { inhoud: ExternInhoud, voorbeeld_tekeningen: string[], gereed: Meldingen }

/**
 * Zoekt de link en controleert hem en de code. Geeft de link als hij open is en de code klopt, anders het
 * antwoord voor de pagina. Een verkeerde code telt en kost even tijd; na tien keer gaat de link dicht.
 * De proefversie gebruikt dezelfde regels op haar eigen tabel.
 */
export async function poort<R extends LinkVelden = Deellink>(event: H3Event, sb: SupabaseClient, tabel: 'deellinks' | 'proef_deellinks' = 'deellinks'): Promise<{ link: R } | { antwoord: ExternAntwoord }> {
  const token = getRouterParam(event, 'token') ?? ''
  const body = await readBody<{ code?: unknown }>(event).catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!TOKEN_VORM.test(token)) return { antwoord: { stand: 'onbekend' } }

  const res = await sb.from(tabel).select('*').eq('token', token).maybeSingle()
  if (res.error) throw nietBereikbaar()
  const link = res.data as R | null
  if (!link) return { antwoord: { stand: 'onbekend' } }
  const nu = new Date()
  const stand = standVan(link, nu)
  if (stand !== 'open') return { antwoord: dichtAntwoord(link, stand) }

  const { wijziging, antwoord } = controleerCode(link, code, !!code && gelijk(code, link.code), nu)
  if (wijziging) await sb.from(tabel).update(wijziging).eq('token', token)
  if (antwoord && (antwoord.stand !== 'code' || antwoord.fout)) await new Promise(r => setTimeout(r, 600)) // raden kost tijd
  return antwoord ? { antwoord } : { link }
}

/** De proefroutes bestaan alleen zolang de app de proefversie is. */
export function alleenInProef(event: H3Event) {
  if (!useRuntimeConfig(event).public.proefversie) throw createError({ statusCode: 404, statusMessage: 'Niet gevonden.' })
}

import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import type { Deellink } from '../../app/lib/types'
import { controleerCode, dichtAntwoord, standVan, TOKEN_VORM, type ExternAntwoord } from '../../app/lib/deellink'

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

/** Vergelijkt twee codes in vaste tijd, zodat de responstijd niets verraadt. */
export function gelijk(a: string, b: string): boolean {
  const x = createHash('sha256').update(a).digest()
  const y = createHash('sha256').update(b).digest()
  return timingSafeEqual(x, y)
}

/**
 * Zoekt de link en controleert hem en de code. Geeft de link als hij open is en de code klopt, anders het
 * antwoord voor de pagina. Een verkeerde code telt en kost even tijd; na tien keer gaat de link dicht.
 */
export async function poort(event: H3Event, sb: SupabaseClient): Promise<{ link: Deellink } | { antwoord: ExternAntwoord }> {
  const token = getRouterParam(event, 'token') ?? ''
  const body = await readBody<{ code?: unknown }>(event).catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!TOKEN_VORM.test(token)) return { antwoord: { stand: 'onbekend' } }

  const res = await sb.from('deellinks').select('*').eq('token', token).maybeSingle()
  if (res.error) throw nietBereikbaar()
  const link = res.data as Deellink | null
  if (!link) return { antwoord: { stand: 'onbekend' } }
  const nu = new Date()
  const stand = standVan(link, nu)
  if (stand !== 'open') return { antwoord: dichtAntwoord(link, stand) }

  const { wijziging, antwoord } = controleerCode(link, code, !!code && gelijk(code, link.code), nu)
  if (wijziging) await sb.from('deellinks').update(wijziging).eq('token', token)
  if (antwoord && (antwoord.stand !== 'code' || antwoord.fout)) await new Promise(r => setTimeout(r, 600)) // raden kost tijd
  return antwoord ? { antwoord } : { link }
}

// De leverancier vinkt op zijn pagina een open punt af als opgelost, of draait dat terug. Het punt blijft open
// tot BbDW het aftekent; wie en wanneer vult de database in (trigger controlepunt_bijwerken).
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const sb = serviceDatabase(event)
  const poging = await poort(event, sb)
  if ('antwoord' in poging) throw createError({ statusCode: 403, statusMessage: 'Deze link is niet (meer) open.' })
  const body = await readBody<{ punt?: unknown, gereed?: unknown }>(event).catch(() => null)
  const punt = typeof body?.punt === 'string' && body.punt.length <= 100 ? body.punt : ''

  const leverancier = await sb.from('leveranciers').select('naam').eq('id', poging.link.leverancier_id).single()
  if (leverancier.error) throw nietBereikbaar()
  const res = await sb.from('controlepunten')
    .update({ gereed_door: body?.gereed === true ? leverancier.data.naam : null })
    .eq('id', punt).eq('leverancier_id', poging.link.leverancier_id).eq('opgelost', false)
    .select('id').maybeSingle()
  if (res.error || !res.data) throw createError({ statusCode: 404, statusMessage: 'Dit punt staat niet (meer) open.' })
  return { ok: true }
})

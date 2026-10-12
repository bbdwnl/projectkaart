// Proefversie: de leverancier vinkt een punt af als opgelost, of draait dat terug. Dat staat bij de kopie op de server;
// de browser van de tester haalt het op (api/proef/deellinks) en BbDW tekent daar af of keurt af.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  alleenInProef(event)
  const sb = serviceDatabase(event)
  const poging = await poort<ProefRij>(event, sb, 'proef_deellinks')
  if ('antwoord' in poging) throw createError({ statusCode: 403, statusMessage: 'Deze link is niet (meer) open.' })
  const body = await readBody<{ punt?: unknown, gereed?: unknown }>(event).catch(() => null)
  const { link } = poging
  const punt = link.inhoud.punten.find(p => p.id === body?.punt)
  if (!punt) throw createError({ statusCode: 404, statusMessage: 'Dit punt staat niet (meer) open.' })
  const gereed = { ...link.gereed }
  if (body?.gereed === true) gereed[punt.id] ??= new Date().toISOString()
  else delete gereed[punt.id]
  const res = await sb.from('proef_deellinks').update({ gereed }).eq('token', link.token)
  if (res.error) throw nietBereikbaar()
  return { ok: true }
})

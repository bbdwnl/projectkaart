// Een tekening voor de pagina van een leverancier: alleen een tekening waarop een open punt van hem staat,
// met een adres dat een uur geldig is. De pagina vraagt het op als de tekening opengaat.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const sb = serviceDatabase(event)
  const poging = await poort(event, sb)
  if ('antwoord' in poging) throw createError({ statusCode: 403, statusMessage: 'Deze link is niet (meer) open.' })

  const id = getRouterParam(event, 'id') ?? ''
  const op = await sb.from('controlepunten').select('id').eq('leverancier_id', poging.link.leverancier_id).eq('opgelost', false).eq('tekening_id', id).limit(1)
  if (op.error || !op.data.length) throw createError({ statusCode: 404, statusMessage: 'Deze tekening hoort niet bij deze link.' })
  const tekening = await sb.from('tekeningen').select('pad').eq('id', id).single()
  if (tekening.error) throw createError({ statusCode: 404, statusMessage: 'Deze tekening hoort niet bij deze link.' })
  const url = await sb.storage.from('tekeningen').createSignedUrl(tekening.data.pad, 60 * 60)
  if (url.error || !url.data) throw nietBereikbaar()
  return { url: url.data.signedUrl }
})

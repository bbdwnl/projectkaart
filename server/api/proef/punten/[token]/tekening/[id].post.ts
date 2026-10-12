import { VOORBEELDTEKENING_URL } from '../../../../../../app/lib/deellink'

// Proefversie: een tekening voor de pagina van een leverancier. De voorbeeldtekening is openbaar; een tekening die de
// tester zelf uploadde, staat in de bucket proef en krijgt een adres dat een uur geldig is.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  alleenInProef(event)
  const sb = serviceDatabase(event)
  const poging = await poort<ProefRij>(event, sb, 'proef_deellinks')
  if ('antwoord' in poging) throw createError({ statusCode: 403, statusMessage: 'Deze link is niet (meer) open.' })
  const id = getRouterParam(event, 'id') ?? ''
  const { link } = poging
  if (!link.inhoud.punten.some(p => p.tekening_id === id)) throw createError({ statusCode: 404, statusMessage: 'Deze tekening hoort niet bij deze link.' })
  if (link.voorbeeld_tekeningen.includes(id)) return { url: VOORBEELDTEKENING_URL }
  const url = await sb.storage.from('proef').createSignedUrl(`${link.token}/${id}.pdf`, 60 * 60)
  if (url.error || !url.data) throw createError({ statusCode: 404, statusMessage: 'Deze tekening is (nog) niet geüpload.' })
  return { url: url.data.signedUrl }
})

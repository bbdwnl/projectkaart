import { TEKENING_ID_VORM, TOKEN_VORM } from '../../../app/lib/deellink'

// Proefversie: een adres waarop de browser van de tester een eigen tekening rechtstreeks in de bucket proef zet
// (een pdf is te groot om via de server te sturen). Alleen voor een tekening waarop een punt van die link staat.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  alleenInProef(event)
  if (!heeftProefToegang(event)) throw createError({ statusCode: 401, statusMessage: 'Wachtwoord nodig.' })
  const body = await readBody<{ token?: unknown, tekeningId?: unknown }>(event).catch(() => null)
  const token = typeof body?.token === 'string' && TOKEN_VORM.test(body.token) ? body.token : null
  const id = typeof body?.tekeningId === 'string' && TEKENING_ID_VORM.test(body.tekeningId) ? body.tekeningId : null
  if (!token || !id) throw createError({ statusCode: 400, statusMessage: 'Deze tekening klopt niet.' })

  const sb = serviceDatabase(event)
  const rij = await sb.from('proef_deellinks').select('inhoud, voorbeeld_tekeningen').eq('token', token).maybeSingle()
  if (rij.error) throw nietBereikbaar()
  const op = rij.data && (rij.data.inhoud as { punten: { tekening_id: string | null }[] }).punten.some(p => p.tekening_id === id)
  if (!op || (rij.data!.voorbeeld_tekeningen as string[]).includes(id)) throw createError({ statusCode: 404, statusMessage: 'Deze tekening hoort niet bij deze link.' })
  const upload = await sb.storage.from('proef').createSignedUploadUrl(`${token}/${id}.pdf`, { upsert: true })
  if (upload.error || !upload.data) throw nietBereikbaar()
  return { url: upload.data.signedUrl }
})

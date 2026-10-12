import { geldigeMeldingen, meldingenUit, schoneProefLink, type Meldingen, type ProefStand } from '../../../app/lib/deellink'

// Proefversie: de browser van een tester zet een kopie van zijn links op de server (of werkt hem bij), zodat een
// leverancier de link ook op een ander apparaat kan openen. Terug komt wat alleen de server weet: gekeken, verkeerde
// codes, en of de link daar dicht ging. Alleen met toegang tot de proefversie.
export default defineEventHandler(async (event): Promise<ProefStand[]> => {
  setHeader(event, 'Cache-Control', 'no-store')
  alleenInProef(event)
  if (!heeftProefToegang(event)) throw createError({ statusCode: 401, statusMessage: 'Wachtwoord nodig.' })
  const sb = serviceDatabase(event)
  const body = await readBody<{ links?: unknown }>(event).catch(() => null)
  const links = (Array.isArray(body?.links) ? body.links.slice(0, 20) : []).map(schoneProefLink)
  if (links.some(l => !l)) throw createError({ statusCode: 400, statusMessage: 'Deze link klopt niet.' })
  const tokens = links.map(l => l!.token)
  if (!tokens.length) return []

  const bestaand = await sb.from('proef_deellinks').select('token, gesloten_reden, gereed').in('token', tokens)
  if (bestaand.error) throw nietBereikbaar()
  const nu = new Date().toISOString()
  for (const l of links as NonNullable<(typeof links)[number]>[]) {
    const oud = bestaand.data.find(r => r.token === l.token)
    const res = !oud
      ? l.inhoud ? await sb.from('proef_deellinks').insert({
          token: l.token, code: l.code, geldig_tot: l.geldig_tot, gesloten_reden: l.gesloten_reden, gesloten_op: l.gesloten_op,
          inhoud: l.inhoud, voorbeeld_tekeningen: l.voorbeeld_tekeningen,
          // Wat al als opgelost gemeld stond; daarna vinkt alleen de leverancier af, hier op de server.
          gereed: meldingenUit(l.inhoud),
        }) : null
      : await sb.from('proef_deellinks').update({
          bijgewerkt_op: nu,
          // Afgetekende en afgekeurde punten vallen af.
          ...(l.inhoud ? { inhoud: l.inhoud, voorbeeld_tekeningen: l.voorbeeld_tekeningen, gereed: geldigeMeldingen(oud.gereed as Meldingen, l.inhoud) } : {}),
          // Dicht blijft dicht: alleen sluiten, nooit weer openen.
          ...(!oud.gesloten_reden && l.gesloten_reden ? { gesloten_reden: l.gesloten_reden, gesloten_op: l.gesloten_op } : {}),
        }).eq('token', l.token)
    if (res?.error) throw createError({ statusCode: 400, statusMessage: `De link opslaan is niet gelukt. ${res.error.message}` })
  }
  // Opruimen: links die al een maand verlopen zijn.
  await sb.from('proef_deellinks').delete().lt('geldig_tot', new Date(Date.now() - 30 * 864e5).toISOString())

  const stand = await sb.from('proef_deellinks').select('token, gesloten_reden, gesloten_op, foute_pogingen, bekeken_op, gereed').in('token', tokens)
  if (stand.error) throw nietBereikbaar()
  return stand.data as ProefStand[]
})

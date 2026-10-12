import { dichtAntwoord, type ExternAntwoord } from '../../../../../app/lib/deellink'

// Proefversie: de pagina van een leverancier, uit de kopie die de browser van de tester op de server zette.
export default defineEventHandler(async (event): Promise<ExternAntwoord> => {
  setHeader(event, 'Cache-Control', 'no-store')
  alleenInProef(event)
  const sb = serviceDatabase(event)
  const poging = await poort<ProefRij>(event, sb, 'proef_deellinks')
  if ('antwoord' in poging) return poging.antwoord
  const { link } = poging
  if (!link.inhoud.punten.length) {
    const op = new Date().toISOString()
    await sb.from('proef_deellinks').update({ gesloten_reden: 'opgelost', gesloten_op: op }).eq('token', link.token)
    return dichtAntwoord({ geldig_tot: link.geldig_tot, gesloten_op: op }, 'opgelost')
  }
  return { stand: 'open', inhoud: { ...link.inhoud, geldig_tot: link.geldig_tot } }
})

import type { Controlepunt } from '../../../../app/lib/types'
import { dichtAntwoord, externeInhoud, openPuntenVan, type ExternAntwoord } from '../../../../app/lib/deellink'

// De pagina van een leverancier: alleen zijn open punten, de projecten waarop ze staan en de tekeningen met
// een plek. Foto's krijgen een tijdelijk adres; de pagina vraagt na een tijd alles opnieuw op.
const FOTO_GELDIG = 2 * 60 * 60

export default defineEventHandler(async (event): Promise<ExternAntwoord> => {
  setHeader(event, 'Cache-Control', 'no-store')
  const sb = serviceDatabase(event)
  const poging = await poort(event, sb)
  if ('antwoord' in poging) return poging.antwoord
  const { link } = poging

  const eigen = await sb.from('controlepunten').select('project_id').eq('leverancier_id', link.leverancier_id).eq('opgelost', false)
  if (eigen.error) throw nietBereikbaar()
  const projectIds = [...new Set(eigen.data.map(p => p.project_id as string))]
  if (!projectIds.length) {
    // Alles opgelost: de trigger sluit de link normaal al; anders nu.
    const dicht = await sb.from('deellinks').update({ gesloten_reden: 'opgelost' }).eq('id', link.id).select('geldig_tot, gesloten_op').single()
    return dichtAntwoord(dicht.data ?? { geldig_tot: link.geldig_tot, gesloten_op: new Date().toISOString() }, 'opgelost')
  }

  const [leverancier, punten, projecten, tekeningen] = await Promise.all([
    sb.from('leveranciers').select('naam, vak').eq('id', link.leverancier_id).single(),
    sb.from('controlepunten').select('*').in('project_id', projectIds),
    sb.from('projecten').select('id, naam, plaats, adres').in('id', projectIds),
    sb.from('tekeningen').select('id, project_id, naam').in('project_id', projectIds),
  ])
  if (leverancier.error || punten.error || projecten.error || tekeningen.error) throw nietBereikbaar()

  const alle = punten.data as Controlepunt[]
  const paden = openPuntenVan(link.leverancier_id, alle).map(p => p.foto)
  const urls = await sb.storage.from('controle').createSignedUrls(paden, FOTO_GELDIG)
  const fotoUrls = new Map((urls.data ?? []).filter(f => f.path && f.signedUrl).map(f => [f.path!, f.signedUrl]))

  return {
    stand: 'open',
    inhoud: externeInhoud({ link, leverancier: leverancier.data, punten: alle, projecten: projecten.data, tekeningen: tekeningen.data, fotoUrl: pad => fotoUrls.get(pad) ?? null }),
  }
})

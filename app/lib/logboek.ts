import type { LogRegel, Uitzondering } from './types'
import { DATUMVELDEN, faseInfo, ROLLEN } from './fasen'
import { vindStandaardtaak } from './taken'
import { statusNaam } from './taak'
import { fmt, naarDatum } from './datum'

export interface LogDeel { tekst: string, nadruk?: boolean }

const leeg = (v: string | null) => !v || v === 'false'

/** Maakt van een logregel een zin: "zette [Terreinplan] op Definitief". */
export function beschrijf(r: LogRegel, catalogus: Uitzondering[]): LogDeel[] {
  const t = (tekst: string): LogDeel => ({ tekst })
  const n = (tekst: string): LogDeel => ({ tekst, nadruk: true })

  if (r.tabel === 'taken') {
    const titel = r.uitzondering_id
      ? catalogus.find(u => u.id === r.uitzondering_id)?.titel ?? 'een uitzondering'
      : (r.lijst && r.sleutel && vindStandaardtaak(r.lijst, r.sleutel)?.titel) || r.sleutel || 'een taak'
    switch (r.veld) {
      case 'status': return [t('zette '), n(titel), t(` op ${statusNaam(r.nieuw)}`)]
      case 'eigenaar': return [t(`maakte ${r.nieuw || 'niemand'} eigenaar van `), n(titel)]
      case 'klantakkoord': return r.nieuw === 'true' ? [t('vinkte klantakkoord aan bij '), n(titel)] : [t('haalde klantakkoord weg bij '), n(titel)]
      case 'document_url':
      case 'document_naam': return leeg(r.nieuw) ? [t('haalde het document weg bij '), n(titel)] : [t('koppelde een document aan '), n(titel)]
      case 'reden_nvt': return [t('gaf een reden voor n.v.t. bij '), n(titel), ...(r.nieuw ? [t(`: ${r.nieuw}`)] : [])]
      case 'deadline': return [t('zette de deadline van '), n(titel), t(` op ${fmt(naarDatum(r.nieuw))}`)]
      case 'notitie': return [t('schreef een notitie bij '), n(titel)]
      case 'aanleiding': return [t('beschreef de aanleiding van '), n(titel)]
      case 'toegevoegd': return [t('voegde uitzondering '), n(titel), t(' toe')]
      case 'verwijderd': return [t('haalde uitzondering '), n(titel), t(' weg')]
      default: return [t(`wijzigde ${r.veld} van `), n(titel)]
    }
  }

  const datum = DATUMVELDEN.find(d => d.veld === r.veld)
  if (datum) return [t('veranderde '), n(datum.naam.toLowerCase()), t(r.nieuw ? ` naar ${fmt(naarDatum(r.nieuw))}` : ': leeggemaakt')]
  if (r.veld in ROLLEN) {
    const rol = ROLLEN[r.veld as keyof typeof ROLLEN]
    return [t(`maakte ${r.nieuw || 'niemand'} `), n(rol.naam.toLowerCase())]
  }
  switch (r.veld) {
    case 'fase': return [t('zette de fase op '), n(r.nieuw ? faseInfo(r.nieuw as never)?.naam ?? r.nieuw : '—')]
    case 'afas_nummer': return [t('zette het AFAS-nummer op '), n(r.nieuw || '—')]
    case 'nummer': return [t('zette het projectnummer op '), n(r.nieuw || '—')]
    case 'soort': return [t('paste de '), n('soort project'), t(' aan')]
    case 'prio': return [t(r.nieuw === 'true' ? 'gaf het project ' : 'haalde '), n('prio'), t(r.nieuw === 'true' ? '' : ' weg')]
    case 'sharepoint_url': case 'extern_url': case 'notitieblok_url': return [t('paste een '), n('link'), t(' aan')]
    case 'tekeningen_locatie': return [t('paste de '), n('locatie van de tekeningen'), t(' aan')]
    default: return [t('wijzigde '), n(r.veld)]
  }
}

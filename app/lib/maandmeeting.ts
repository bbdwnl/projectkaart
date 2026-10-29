import type { Actie, Controlepunt, Fase, Licht, Project, Rol, Taak, Uitzondering } from './types'
import { DATUMVELDEN, FASEN, faseInfo } from './fasen'
import { ORDE, takenVan } from './stoplicht'
import { signalen, SOORTEN as SIGNAAL } from './signalen'
import { isAfgehandeld, voornaam } from './overzicht'
import { dagenTussen, naarDatum, plusDagen } from './datum'

// De maandelijkse meeting (uit de offerte, fase C): de fase-eigenaren bekijken met de bedrijfsleider welke werken
// afwijken. Per fase de projecten die afwijken, het ernstigste eerst, met in woorden waarom; daaronder wat op schema
// ligt, en de mijlpalen tot de volgende meeting. Niet mee: afgehandelde nazorg en leads in de wachtkamer.

export interface Afwijking { licht: Licht, tekst: string }

export interface MeetingRij {
  p: Project
  rol: Rol
  /** De voornaam van wie in deze fase verantwoordelijk is, of null. */
  wie: string | null
  licht: Licht
  afwijkingen: Afwijking[]
}

export interface MeetingFase { fase: Fase, naam: string, rol: Rol, afwijkend: MeetingRij[], opSchema: MeetingRij[] }
export interface MeetingMijlpaal { p: Project, naam: string, datum: Date, dagen: number }

/** Tot de volgende meeting: vijf weken vooruit. */
export const VOORUIT_DAGEN = 35

const lijstTekst = (titels: string[], max = 3) => titels.slice(0, max).join(', ') + (titels.length > max ? ` en ${titels.length - max} meer` : '')
const aantal = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`

export function meeting(
  projecten: Project[], taken: Taak[], catalogus: Uitzondering[], acties: Actie[], punten: Controlepunt[], nu: Date,
): { fasen: MeetingFase[], mijlpalen: MeetingMijlpaal[] } {
  const mee = projecten.filter(p => !isAfgehandeld(p) && !(p.fase === 'lead' && p.wachtkamer))
  const perProject = new Map<string, Afwijking[]>()
  for (const s of signalen(mee, nu)) {
    for (const p of s.projecten) {
      const a = perProject.get(p.slug) ?? []
      // "Nog geen projectmanager: 3 projecten." wordt bij elk project "Nog geen projectmanager."
      const tekst = s.tekst.replace(/: \d+ (project|projecten)\.$/, '.')
      a.push({ licht: SIGNAAL[s.soort].licht === 'open' ? 'letop' : SIGNAAL[s.soort].licht, tekst })
      perProject.set(p.slug, a)
    }
  }

  const rij = (p: Project): MeetingRij => {
    const rol = faseInfo(p.fase).rol
    const regels = takenVan(p.fase, p, taken.filter(t => t.project_id === p.id), catalogus, nu)
    const af: Afwijking[] = []
    const laat = regels.filter(r => r.b.licht === 'telaat')
    const letop = regels.filter(r => r.b.licht === 'letop')
    if (laat.length) af.push({ licht: 'telaat', tekst: `${aantal(laat.length, 'taak', 'taken')} te laat: ${lijstTekst(laat.map(r => r.titel))}` })
    if (letop.length) af.push({ licht: 'letop', tekst: `${aantal(letop.length, 'taak', 'taken')} let op: ${lijstTekst(letop.map(r => r.titel))}` })
    const open = acties.filter(a => a.project_id === p.id && !a.gereed)
    const actiesLaat = open.filter(a => a.deadline && naarDatum(a.deadline)! < nu)
    if (actiesLaat.length) af.push({ licht: 'telaat', tekst: `${aantal(actiesLaat.length, 'actie', 'acties')} uit het overleg te laat` })
    const puntenOpen = punten.filter(c => c.project_id === p.id && !c.opgelost)
    if (puntenOpen.length) af.push({ licht: 'letop', tekst: `${aantal(puntenOpen.length, 'aandachtspunt', 'aandachtspunten')} open bij Controle` })
    af.push(...(perProject.get(p.slug) ?? []))
    const licht = af.length ? af.reduce<Licht>((l, a) => (ORDE[a.licht] < ORDE[l] ? a.licht : l), 'letop') : 'klaar'
    return { p, rol, wie: voornaam(p[rol]), licht, afwijkingen: af.sort((a, b) => ORDE[a.licht] - ORDE[b.licht]) }
  }

  const ernst = (r: MeetingRij) => r.afwijkingen.reduce((n, a) => n + (a.licht === 'telaat' ? 100 : 1), 0)
  const fasen = FASEN.map((f) => {
    const rijen = mee.filter(p => p.fase === f.id).map(rij)
    return {
      fase: f.id, naam: f.naam, rol: f.rol,
      afwijkend: rijen.filter(r => r.afwijkingen.length)
        .sort((a, b) => ORDE[a.licht] - ORDE[b.licht] || ernst(b) - ernst(a) || a.p.naam.localeCompare(b.p.naam, 'nl')),
      opSchema: rijen.filter(r => !r.afwijkingen.length).sort((a, b) => a.p.naam.localeCompare(b.p.naam, 'nl')),
    }
  })

  // Alle harde datums tot de volgende meeting, niet alleen de mijlpaal van de fase.
  const tot = plusDagen(nu, VOORUIT_DAGEN)
  const mijlpalen: MeetingMijlpaal[] = []
  for (const p of mee) {
    for (const d of DATUMVELDEN) {
      const datum = naarDatum(p[d.veld])
      if (datum && datum >= nu && datum <= tot) mijlpalen.push({ p, naam: d.naam, datum, dagen: dagenTussen(nu, datum) })
    }
  }
  mijlpalen.sort((a, b) => a.datum.getTime() - b.datum.getTime() || a.p.naam.localeCompare(b.p.naam, 'nl'))
  return { fasen, mijlpalen }
}

/** Filter op wie verantwoordelijk is: een voornaam, 'geen' of 'alle'. */
export const pastBij = (r: MeetingRij, wie: string) => wie === 'alle' || (r.wie ?? 'geen') === wie

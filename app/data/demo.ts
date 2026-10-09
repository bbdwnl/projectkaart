// Voorbeeldgegevens voor de proefversie. Projectnamen, nummers en datums komen uit het
// prototype (projecten.json); statussen, mensen, documenten, bedragen en de leads zijn verzonnen.
// Draait op de server (server/api/proef/gegevens.get.ts), zodat de projectnamen niet in de
// JavaScript van de browser zitten. Daarom relatieve imports.
import type { Controlepunt, Fase, Financien, Leverancier, LogRegel, ProjectLeverancier, Project, Soort, Status, Taak, Uitzondering } from '../lib/types'
import { FASEN, faseIndex, MENSEN } from '../lib/fasen'
import { LIJSTEN } from '../lib/taken'
import { deadlineVan } from '../lib/stoplicht'
import { dagenTussen, naarIso, plusDagen } from '../lib/datum'
import { leegTaak } from '../lib/taak'
import { leegProject, maakSlug } from '../lib/leads'

/** Eén regel uit projecten.json. */
export interface ProjectBasis {
  slug: string
  nummer: string | null
  naam: string
  plaats: string | null
  fase: string
  prio: boolean
  po: string | null
  datum_casco: string | null
  datum_voorbereiding: string | null
  datum_inkoop: string | null
  datum_afbouw: string | null
  datum_oplevering: string | null
}

export const LEGE_GEGEVENS = (): DemoGegevens => ({ projecten: [], taken: [], uitzonderingen: [], financien: [], logboek: [], leveranciers: [], projectLeveranciers: [], controlepunten: [], fotos: {} })

export interface DemoGegevens {
  projecten: Project[]
  taken: Taak[]
  uitzonderingen: Uitzondering[]
  financien: Financien[]
  logboek: LogRegel[]
  leveranciers: Leverancier[]
  projectLeveranciers: ProjectLeverancier[]
  controlepunten: Controlepunt[]
  /** De foto's van de aandachtspunten, als data-URL per pad. Alleen in de browser van de tester. */
  fotos: Record<string, string>
}

/** Vaste "toeval" per sleutel, zodat de demo elke keer hetzelfde is. */
function kans(sleutel: string): number {
  let h = 2166136261
  for (let i = 0; i < sleutel.length; i++) h = Math.imul(h ^ sleutel.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}
const kies = <T>(lijst: T[], sleutel: string): T => lijst[Math.floor(kans(sleutel) * lijst.length)]!


// Het prototype had geen leads: deze zijn verzonnen. Naam, plaats, AM, kans, prio, soort, m², dagen sinds de laatste wijziging.
const LEADS: [string, string, string | null, number | null, boolean, Soort[], number | null, number][] = [
  ['Gezondheidscentrum De Brink', 'Zwolle', 'Jeroen', 75, true, ['ont', 'tk'], 1400, 3],
  ['Huisartsenpost Rivierenland', 'Tiel', 'Peter', 50, false, ['ont'], 620, 12],
  ['Fysio en tandarts Kloosterhof', 'Veghel', 'Jeroen', 25, false, [], null, 40],
  ['Medisch centrum Stationsplein', 'Ede', 'Benno', 100, true, ['tk'], 2100, 1],
  ['Apotheek en huisartsen Oosterpark', 'Groningen', 'Peter', null, false, [], null, 65],
  ['Kindergezondheidscentrum Het Anker', 'Harderwijk', 'Michiel', 50, false, ['adv'], 480, 20],
  ['Gezondheidshuis Molenwijk', 'Oss', null, 0, false, [], null, 90],
  ['Zorgplein Noord', 'Almere', 'Jeroen', 75, false, ['ont'], 1750, 6],
]

// De globale lijst met leveranciers (verzonnen). De eerste vijf werken op de projecten in uitvoering en nazorg
// en op Apeldoorn Vlijtseweg; de laatste twee staan alleen in de lijst, om uit te kiezen.
const LEVERANCIERS: [string, string][] = [
  ['Bouwbedrijf Van Wijk', 'Aannemer casco'],
  ['Klimaattechniek Oost', 'Installateur'],
  ['Elektro Hendriks', 'Elektra'],
  ['Interieurbouw De Lange', 'Afbouw en interieur'],
  ['Schildersbedrijf Jansen', 'Schilderwerk'],
  ['Glaszetterij Veenstra', 'Glas'],
  ['Liftservice Brabant', 'Liften'],
]

const CATALOGUS: [string, string, Fase, number][] = [
  ['u-netcongestie', 'Nutsaansluiting verzwaren (netcongestie)', 'ontwikkeling', 7],
  ['u-pfas', 'Extra bodemonderzoek (PFAS)', 'ontwikkeling', 5],
  ['u-asbest', 'Asbestinventarisatie', 'haalbaarheid', 4],
  ['u-parkeren', 'Parkeeronderzoek gemeente', 'ontwikkeling', 3],
  ['u-flora', 'Flora- en faunaonderzoek', 'ontwikkeling', 3],
  ['u-archeologie', 'Archeologisch onderzoek', 'ontwikkeling', 2],
  ['u-geluid', 'Geluidsonderzoek installaties', 'ontwikkeling', 1],
  ['u-monument', 'Monumentenvergunning', 'ontwikkeling', 1],
]

// Apeldoorn Vlijtseweg: precies zoals in design-referentie.html.
const VLIJTSEWEG: Record<string, [Status, string, string?, { akk?: boolean, n?: string, nvt?: string }?]> = {
  'lead:betaalde_opdracht': ['definitief', 'Jeroen', 'P20038 – Opdrachtbevestiging – 2025-11-04.pdf', { akk: true }],
  'lead:risico': ['definitief', 'Jeroen', 'P20038 – Risico\'s en kansen – v2.docx'],
  'haalbaarheid:demarcatie': ['definitief', 'Jeroen', 'P20038 – Demarcatie – v1.pdf'],
  'haalbaarheid:opleverniveau': ['definitief', 'Jeroen', 'P20038 – Opleverniveau – v2.pdf', { akk: true }],
  'haalbaarheid:stiko_vo': ['definitief', 'Michiel', 'P20038 – STIKO VO – v3.xlsx'],
  'haalbaarheid:principeverzoek': ['definitief', 'Jeroen', 'P20038 – Principeverzoek – 2026-03-12.pdf'],
  'haalbaarheid:bestemmingsplan': ['definitief', 'Adviseur', 'P20038 – Toets bestemmingsplan.pdf'],
  'haalbaarheid:vo_tekening': ['definitief', 'Architect', 'P20038 – VO tekening – rev C.pdf', { akk: true }],
  'haalbaarheid:m2_verdeelstaat': ['definitief', 'Jeroen', 'P20038 – M2 verdeelstaat – v2.xlsx'],
  'haalbaarheid:stakeholders_vo': ['definitief', 'Jeroen', 'P20038 – Stakeholders – v1.xlsx'],
  'haalbaarheid:basisopdracht': ['definitief', 'Jeroen', 'P20038 – Basisopdracht – v1.pdf', { akk: true }],
  'haalbaarheid:scope': ['definitief', 'Jeroen', 'P20038 – Scope – v2.pdf', { akk: true }],
  'haalbaarheid:opdracht': ['definitief', 'Jeroen', 'P20038 – Opdracht ontwikkeling – getekend.pdf', { akk: true }],
  'haalbaarheid:fin_haalbaar': ['definitief', 'Benno', 'P20038 – Haalbaarheidsberekening – v4.xlsx'],
  'ontwikkeling:demarcatie': ['definitief', 'Michiel', 'P20038 – Demarcatie – v2.pdf'],
  'ontwikkeling:principeverzoek': ['definitief', 'Michiel', 'P20038 – Principebesluit gemeente.pdf'],
  'ontwikkeling:bestemmingsplan': ['definitief', 'Adviseur', 'P20038 – Bestemmingsplan akkoord.pdf'],
  'ontwikkeling:basisopdracht': ['definitief', 'Michiel', 'P20038 – Basisopdracht – v2.pdf', { akk: true }],
  'ontwikkeling:stakeholders_ov': ['definitief', 'Michiel', 'P20038 – Stakeholders – v3.xlsx'],
  'ontwikkeling:overall_planning': ['definitief', 'Michiel', 'P20038 – Planning – v5.pdf'],
  'ontwikkeling:externe_adviseurs': ['definitief', 'Michiel', 'P20038 – Adviseurs – opdrachten.pdf'],
  'ontwikkeling:look_feel': ['definitief', 'Michiel', 'P20038 – Look en Feel – v2.pdf', { akk: true }],
  'ontwikkeling:do_casco': ['definitief', 'Architect', 'P20038 – DO Casco – rev D.pdf', { akk: true }],
  'ontwikkeling:do_installaties': ['concept', 'Adviseur', undefined, { n: 'Wacht op gewichten liftleverancier.' }],
  'ontwikkeling:do_afbouw': ['definitief', 'Architect', 'P20038 – DO Afbouw – rev B.pdf', { akk: true }],
  'ontwikkeling:sloopplan': ['nvt', 'Michiel', undefined, { nvt: 'Nieuwbouw, er wordt niets gesloopt.' }],
  'ontwikkeling:rioolplan': ['definitief', 'Adviseur', 'P20038 – Rioolplan – v1.pdf'],
  'ontwikkeling:terreinplan': ['loopt', 'Architect'],
  'ontwikkeling:zonnepanelen': ['definitief', 'Leverancier', 'P20038 – PV projectie – v2.pdf'],
  'ontwikkeling:elektra': ['definitief', 'Adviseur'],
  'ontwikkeling:constructie': ['definitief', 'Adviseur', 'P20038 – Constructieberekening – v3.pdf'],
  'ontwikkeling:pve_casco': ['definitief', 'Michiel', 'P20038 – PvE Casco – v2.pdf'],
  'ontwikkeling:vergunningsset': ['definitief', 'Architect', 'P20038 – Vergunningsset – ingediend.pdf'],
  'ontwikkeling:brandveiligheid': ['loopt', 'Adviseur', undefined, { n: 'Vragen van de brandweer liggen bij de adviseur.' }],
  'ontwikkeling:doorsnedes': ['definitief', 'Architect', 'P20038 – Doorsnedes en details – rev A.pdf'],
  'ontwikkeling:pve_afbouw': ['concept', 'Michiel'],
  'ontwikkeling:m2_def': ['definitief', 'Architect', 'P20038 – M2 staat VVO BVO – v2.pdf'],
  'ontwikkeling:elementenbegroting': ['loopt', 'Michiel'],
  'ontwikkeling:financiering': ['niet_gestart', 'Benno'],
  'ontwikkeling:huurovereenkomsten': ['concept', 'Benno'],
  'ontwikkeling:casco_aanbesteding': ['loopt', 'Michiel'],
  'ontwikkeling:energielabel_vl': ['niet_gestart', 'Adviseur'],
}

export function maakDemoGegevens(nu: Date, basis: ProjectBasis[]): DemoGegevens {
  const nummerOf = (p: { nummer: string | null, naam: string }) => p.nummer ?? p.naam
  const projecten: Project[] = basis.map((j) => {
    const fase = j.fase as Fase
    const p: Project = {
      id: `p-${j.slug}`, slug: j.slug, nummer: j.nummer, afas_nummer: null, naam: j.naam, plaats: j.plaats, adres: null,
      fase, prio: j.prio, soort: [], m2: null, slagingskans: null,
      am: kies(MENSEN.am.filter(m => m === 'Jeroen' || m === 'Peter'), j.slug + 'am'),
      po: j.po,
      pm: faseIndex(fase) >= faseIndex('uitvoering') ? kies(MENSEN.pm, j.slug + 'pm') : null,
      opzichter: faseIndex(fase) >= faseIndex('uitvoering') ? kies(MENSEN.opzichter, j.slug + 'oz') : null,
      datum_casco: j.datum_casco, datum_voorbereiding: j.datum_voorbereiding, datum_inkoop: j.datum_inkoop,
      datum_afbouw: j.datum_afbouw, datum_oplevering: j.datum_oplevering,
      sharepoint_url: null, extern_url: null, notitieblok_url: null, tekeningen_locatie: null, gewijzigd_op: null,
    }
    if (j.nummer === 'P20038') {
      Object.assign(p, { am: 'Jeroen', po: 'Michiel', adres: 'Vlijtseweg, Apeldoorn', m2: 1850, soort: ['ont'], tekeningen_locatie: '\\\\server\\tekeningen\\P20038' })
    }
    return p
  })
  for (const [naam, plaats, am, slagingskans, prio, soort, m2, dagenGeleden] of LEADS) {
    const slug = maakSlug(naam, projecten.map(p => p.slug))
    projecten.push(leegProject({ id: `p-${slug}`, slug, naam, plaats, am, slagingskans, prio, soort, m2, gewijzigd_op: plusDagen(nu, -dagenGeleden).toISOString() }))
  }

  const taken: Taak[] = []
  const nieuw = (p: Project, extra: Partial<Taak> & Pick<Taak, 'fase'>) => {
    const t = leegTaak({ id: `t-${taken.length + 1}`, project_id: p.id, ...extra })
    if (t.status === 'definitief') { t.afgetekend_door = t.eigenaar ?? 'Michiel'; t.afgetekend_op = naarIso(plusDagen(nu, -Math.round(kans(t.id) * 40) - 2)) }
    if (t.klantakkoord) { t.klantakkoord_door = t.eigenaar ?? 'Michiel'; t.klantakkoord_op = t.afgetekend_op }
    taken.push(t)
    return t
  }

  for (const p of projecten) {
    const fi = faseIndex(p.fase)
    for (const f of FASEN) {
      if (faseIndex(f.id) > fi) continue
      const eigenaar = f.id === 'ontwikkeling' ? p.po : f.id === 'uitvoering' || f.id === 'nazorg' ? p.pm : p.am
      for (const s of LIJSTEN[f.id].flatMap(g => g.taken)) {
        const sleutel = `${f.id}:${s.sleutel}`
        if (p.nummer === 'P20038') {
          const v = VLIJTSEWEG[sleutel]
          if (!v) continue
          const [status, wie, doc, extra] = v
          nieuw(p, { lijst: f.id, sleutel: s.sleutel, fase: f.id, status, eigenaar: wie, document_naam: doc ?? null, klantakkoord: !!extra?.akk, notitie: extra?.n ?? null, reden_nvt: extra?.nvt ?? null })
          continue
        }
        const r = kans(p.slug + sleutel)
        const deadline = deadlineVan(s.regel, p)
        const n = deadline ? dagenTussen(nu, deadline) : null
        let status: Status
        if (faseIndex(f.id) < fi) status = r < 0.05 ? 'nvt' : 'definitief'
        else if (n === null) status = r < 0.4 ? 'definitief' : r < 0.7 ? 'loopt' : 'niet_gestart'
        else if (n < -21) status = r < 0.85 ? 'definitief' : r < 0.95 ? 'concept' : 'loopt'
        else if (n < 0) status = r < 0.55 ? 'definitief' : r < 0.8 ? 'loopt' : 'concept'
        else if (n <= 14) status = r < 0.25 ? 'definitief' : r < 0.7 ? 'loopt' : 'niet_gestart'
        else status = r < 0.1 ? 'loopt' : 'niet_gestart'
        if (status === 'niet_gestart' && r > 0.5) continue // nog geen regel: zoals een nieuw project
        nieuw(p, {
          lijst: f.id, sleutel: s.sleutel, fase: f.id, status, eigenaar,
          document_naam: status === 'definitief' && r < 0.93 ? `${nummerOf(p)} – ${s.titel} – v${1 + Math.floor(r * 4)}.pdf` : null,
          reden_nvt: status === 'nvt' ? 'Niet van toepassing in dit project.' : null,
          klantakkoord: status === 'definitief' && r < 0.2,
        })
      }
    }
  }

  // Uitzonderingen: de catalogus, en per uitzondering een vast aantal projecten die die fase bereikten.
  const uitzonderingen: Uitzondering[] = CATALOGUS.map(([id, titel, fase]) => ({ id, titel, fase, status: 'uitzondering', aangemaakt_op: naarIso(plusDagen(nu, -120)) }))
  const vlijtseweg = projecten.find(p => p.nummer === 'P20038')!
  for (const [id, , fase, aantal] of CATALOGUS) {
    const kandidaten = projecten.filter(p => p !== vlijtseweg && faseIndex(p.fase) >= faseIndex(fase)).sort((a, b) => kans(a.slug + id) - kans(b.slug + id))
    const extra = id === 'u-pfas' || id === 'u-parkeren' ? 1 : 0
    for (const p of kandidaten.slice(0, aantal - extra)) {
      const deadline = naarIso(plusDagen(nu, Math.round(kans(p.slug + id + 'd') * 80) - 40))
      const af = faseIndex(p.fase) > faseIndex(fase) || kans(p.slug + id + 's') < 0.4
      nieuw(p, { uitzondering_id: id, fase, deadline, status: af ? 'definitief' : 'loopt', eigenaar: p.po ?? p.am, document_naam: af ? `${nummerOf(p)} – ${CATALOGUS.find(c => c[0] === id)![1]}.pdf` : null })
    }
  }
  nieuw(vlijtseweg, { uitzondering_id: 'u-pfas', fase: 'ontwikkeling', deadline: naarIso(plusDagen(nu, 8)), status: 'loopt', eigenaar: 'Adviseur', aanleiding: 'Gemeente vraagt PFAS-onderzoek vóór de omgevingsvergunning.' })
  nieuw(vlijtseweg, { uitzondering_id: 'u-parkeren', fase: 'ontwikkeling', deadline: '2026-09-01', status: 'definitief', eigenaar: 'Michiel', document_naam: 'P20038 – Parkeeronderzoek – v2.pdf', aanleiding: 'Voorwaarde uit het principebesluit.' })

  const financien: Financien[] = [{
    project_id: vlijtseweg.id,
    prognose_omzet_uren: 84000, prognose_omzet_turnkey: 1240000, prognose_inkoop: 1010000,
    opdracht_uren: 78500, opdracht_turnkey: 1195000, opdracht_inkoop_derden: 0,
    omzet_gefactureerd: 312000, kosten_uren: 41200, kosten_onderaanneming: 0, bm_werkelijk: 78500,
  }]

  const moment = (dagenTerug: number, uur: number, min: number) => {
    const d = plusDagen(nu, -dagenTerug)
    d.setHours(uur, min)
    return d.toISOString()
  }
  const taakVan = (lijst: Fase, sleutel: string) => taken.find(t => t.project_id === vlijtseweg.id && t.lijst === lijst && t.sleutel === sleutel)!
  const log = (op: string, door: string, veld: string, oud: string | null, nieuw: string | null, t?: Taak): LogRegel => ({
    id: `l-${op}`, project_id: vlijtseweg.id, op, door, tabel: t ? 'taken' : 'projecten', taak_id: t?.id ?? null,
    lijst: t?.lijst ?? null, sleutel: t?.sleutel ?? null, uitzondering_id: t?.uitzondering_id ?? null, veld, oud, nieuw,
  })
  const pfas = taken.find(t => t.project_id === vlijtseweg.id && t.uitzondering_id === 'u-pfas')!
  const logboek: LogRegel[] = [
    log(moment(0, 9, 12), 'Michiel', 'status', 'niet_gestart', 'loopt', taakVan('ontwikkeling', 'elementenbegroting')),
    log(moment(1, 16, 40), 'Michiel', 'document_naam', null, 'P20038 – Vergunningsset – ingediend.pdf', taakVan('ontwikkeling', 'vergunningsset')),
    log(moment(2, 11, 3), 'Michiel', 'klantakkoord', 'false', 'true', taakVan('ontwikkeling', 'look_feel')),
    log(moment(5, 14, 21), 'Michiel', 'toegevoegd', null, null, pfas),
    log(moment(7, 10, 0), 'Benno', 'fase', 'haalbaarheid', 'ontwikkeling'),
  ]

  const leveranciers: Leverancier[] = LEVERANCIERS.map(([naam, vak], i) => ({ id: `lev-${i + 1}`, naam, vak, globaal: true }))
  const projectLeveranciers: ProjectLeverancier[] = projecten
    .filter(p => p === vlijtseweg || faseIndex(p.fase) >= faseIndex('uitvoering'))
    .flatMap(p => leveranciers.slice(0, 5).filter((_, i) => p === vlijtseweg || kans(p.slug + i) < 0.7)
      .map(l => ({ project_id: p.id, leverancier_id: l.id })))
  // Eén die alleen voor Vlijtseweg is aangemaakt.
  leveranciers.push({ id: 'lev-vlijtseweg-hovenier', naam: 'Hoveniersbedrijf De Linde', vak: 'Terrein', globaal: false })
  projectLeveranciers.push({ project_id: vlijtseweg.id, leverancier_id: 'lev-vlijtseweg-hovenier' })

  // Geen voorbeeldpunten: een aandachtspunt hoort bij een echte foto.
  return { projecten, taken, uitzonderingen, financien, logboek, leveranciers, projectLeveranciers, controlepunten: [], fotos: {} }
}

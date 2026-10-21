import type { Project, ProjectDatums } from './types'
import { DATUMVELDEN, faseInfo, ROLLEN } from './fasen'
import { fmt, naarDatum } from './datum'

// Aandachtspunten in de planning (zoals in het prototype): wat opvalt aan de datums en de mensen van de lopende
// projecten. Geen fouten die de app tegenhoudt, wel vragen die iemand moet beantwoorden.

export interface Signaal {
  /** Een vraag ("klopt dat?") of iets dat ontbreekt of niet kan. */
  soort: 'vraag' | 'ontbreekt' | 'klopt-niet'
  tekst: string
  projecten: Pick<Project, 'slug' | 'naam'>[]
}

const LOPEND = ['ontwikkeling', 'uitvoering', 'nazorg']
const naamVan = (v: keyof ProjectDatums) => DATUMVELDEN.find(d => d.veld === v)!.naam.toLowerCase()

/** Wat vóór wat moet komen; casco na de start van de voorbereiding kan, maar is een vraag waard. */
const VOLGORDE: [keyof ProjectDatums, keyof ProjectDatums, Signaal['soort']][] = [
  ['datum_voorbereiding', 'datum_inkoop', 'klopt-niet'],
  ['datum_inkoop', 'datum_afbouw', 'klopt-niet'],
  ['datum_casco', 'datum_afbouw', 'klopt-niet'],
  ['datum_afbouw', 'datum_oplevering', 'klopt-niet'],
  ['datum_casco', 'datum_voorbereiding', 'vraag'],
]

export function signalen(projecten: Project[], nu: Date): Signaal[] {
  const lopend = projecten.filter(p => LOPEND.includes(p.fase))
  const d = (p: Project, v: keyof ProjectDatums) => naarDatum(p[v])
  const uit: Signaal[] = []
  const lijst = (soort: Signaal['soort'], tekst: string, ps: Project[]) => {
    if (ps.length) uit.push({ soort, tekst, projecten: ps.map(p => ({ slug: p.slug, naam: p.naam })) })
  }

  for (const p of lopend) {
    for (const [eerst, dan, soort] of VOLGORDE) {
      const a = d(p, eerst), b = d(p, dan)
      if (!a || !b || a <= b) continue
      lijst(soort, soort === 'vraag'
        ? `${p.naam} start casco (${fmt(a)}) ná de start van de voorbereiding (${fmt(b)}). Klopt dat?`
        : `${p.naam}: ${naamVan(eerst)} (${fmt(a)}) ligt ná ${naamVan(dan)} (${fmt(b)}).`, [p])
    }
  }

  const zonderOplevering = lopend.filter(p => p.fase !== 'nazorg' && d(p, 'datum_afbouw') && !d(p, 'datum_oplevering'))
  const gestart = zonderOplevering.filter(p => d(p, 'datum_afbouw')! <= nu)
  lijst('ontbreekt', `Afbouw al gestart, nog geen opleverdatum: ${gestart.length} ${gestart.length === 1 ? 'project' : 'projecten'}.`, gestart)
  const nogNiet = zonderOplevering.filter(p => !gestart.includes(p))
  lijst('ontbreekt', `Start afbouw bekend, nog geen opleverdatum: ${nogNiet.length} ${nogNiet.length === 1 ? 'project' : 'projecten'}.`, nogNiet)

  const geenInkoop = lopend.filter(p => p.fase === 'ontwikkeling' && !d(p, 'datum_inkoop'))
  lijst('ontbreekt', `In ontwikkeling zonder datum inkoop gereed: daardoor geen deadlines voor de stukken.`, geenInkoop)

  const voorbij = lopend.filter(p => p.fase !== 'nazorg' && d(p, 'datum_oplevering') && d(p, 'datum_oplevering')! < nu)
  lijst('klopt-niet', 'Oplevering is voorbij, maar het project staat nog niet in nazorg.', voorbij)

  for (const rol of ['po', 'pm'] as const) {
    const zonder = lopend.filter(p => faseInfo(p.fase).rol === rol && !p[rol])
    lijst('ontbreekt', `Nog geen ${ROLLEN[rol].naam.toLowerCase()}: ${zonder.length} ${zonder.length === 1 ? 'project' : 'projecten'}.`, zonder)
  }

  // Veel starts afbouw op dezelfde dag: vanaf drie projecten.
  const perDag = new Map<string, Project[]>()
  for (const p of lopend) {
    const a = d(p, 'datum_afbouw')
    if (a && a >= nu) perDag.set(p.datum_afbouw!, [...(perDag.get(p.datum_afbouw!) ?? []), p])
  }
  for (const [dag, ps] of [...perDag].sort(([a], [b]) => a.localeCompare(b))) {
    if (ps.length >= 3) lijst('vraag', `Op ${fmt(naarDatum(dag))} starten ${ps.length} projecten de afbouw.`, ps)
  }

  const volgorde: Record<Signaal['soort'], number> = { 'klopt-niet': 0, 'vraag': 1, 'ontbreekt': 2 }
  return uit.sort((a, b) => volgorde[a.soort] - volgorde[b.soort])
}

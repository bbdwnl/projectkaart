import type { Fase, Project, Taak, Uitzondering } from './types'
import { faseIndex } from './fasen'
import { vindStandaardtaak } from './taken'

/**
 * Een uitzondering wordt een kandidaat voor het standaardpakket als hij in
 * minstens 4 projecten voorkomt, of in minstens 20% van de projecten die die
 * fase bereikten (en dan wel in minstens 2).
 */
export const KANDIDAAT_MIN_PROJECTEN = 4
export const KANDIDAAT_MIN_AANDEEL = 0.2

export function isKandidaat(aantal: number, bereikt: number): boolean {
  if (aantal >= KANDIDAAT_MIN_PROJECTEN) return true
  return aantal >= 2 && bereikt > 0 && aantal / bereikt >= KANDIDAAT_MIN_AANDEEL
}

/** Hoeveel projecten deze fase bereikten (of voorbij zijn). */
export const bereiktFase = (projecten: Pick<Project, 'fase'>[], fase: Fase) =>
  projecten.filter(p => faseIndex(p.fase) >= faseIndex(fase)).length

export interface UitzonderingAnalyse {
  uitzondering: Uitzondering
  aantal: number
  bereikt: number
  aandeel: number
  projecten: Project[]
  kandidaat: boolean
}

export function analyseUitzonderingen(catalogus: Uitzondering[], taken: Taak[], projecten: Project[]): UitzonderingAnalyse[] {
  return catalogus.map((u) => {
    const ids = new Set(taken.filter(t => t.uitzondering_id === u.id).map(t => t.project_id))
    const bereikt = bereiktFase(projecten, u.fase)
    return {
      uitzondering: u,
      aantal: ids.size,
      bereikt,
      aandeel: bereikt ? ids.size / bereikt : 0,
      projecten: projecten.filter(p => ids.has(p.id)),
      kandidaat: u.status !== 'standaard' && isKandidaat(ids.size, bereikt),
    }
  }).sort((a, b) => b.aantal - a.aantal || a.uitzondering.titel.localeCompare(b.uitzondering.titel, 'nl'))
}

export interface NvtAnalyse {
  lijst: Fase
  sleutel: string
  titel: string
  aantal: number
  bereikt: number
  aandeel: number
  redenen: string[]
}

/** De keerzijde: standaardtaken die vaak niet van toepassing zijn. Kandidaat om te schrappen of af te laten hangen van de soort project. */
export function vaakNvt(taken: Taak[], projecten: Project[], minimaal = 2): NvtAnalyse[] {
  const groepen = new Map<string, Taak[]>()
  for (const t of taken) {
    if (t.status !== 'nvt' || !t.lijst || !t.sleutel) continue
    const k = `${t.lijst}:${t.sleutel}`
    groepen.set(k, [...(groepen.get(k) ?? []), t])
  }
  const uit: NvtAnalyse[] = []
  for (const [k, lijstTaken] of groepen) {
    const [lijst, sleutel] = k.split(':') as [Fase, string]
    const aantal = new Set(lijstTaken.map(t => t.project_id)).size
    if (aantal < minimaal) continue
    const bereikt = bereiktFase(projecten, lijst)
    uit.push({
      lijst, sleutel,
      titel: vindStandaardtaak(lijst, sleutel)?.titel ?? sleutel,
      aantal, bereikt, aandeel: bereikt ? aantal / bereikt : 0,
      redenen: [...new Set(lijstTaken.map(t => t.reden_nvt).filter((r): r is string => !!r))],
    })
  }
  return uit.sort((a, b) => b.aantal - a.aantal)
}

/** Per uitzondering: in hoeveel projecten hij voorkomt (voor de suggesties bij toevoegen). */
export function aantalPerUitzondering(taken: Taak[]): Map<string, number> {
  const sets = new Map<string, Set<string>>()
  for (const t of taken) {
    if (!t.uitzondering_id) continue
    if (!sets.has(t.uitzondering_id)) sets.set(t.uitzondering_id, new Set())
    sets.get(t.uitzondering_id)!.add(t.project_id)
  }
  return new Map([...sets].map(([id, s]) => [id, s.size]))
}

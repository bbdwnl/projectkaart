import type { Controlepunt } from './types'

// Controle: de lijst met aandachtspunten op de projectkaart.

export type ControleFilter = 'open' | 'opgelost' | 'alles'

export function pastPunt(p: Controlepunt, filter: ControleFilter, leverancier: string): boolean {
  if (leverancier !== 'alle' && p.leverancier_id !== leverancier) return false
  return filter === 'alles' || (filter === 'open') === !p.opgelost
}

/** Open punten eerst, daarbinnen het nieuwste bovenaan. */
export function sorteerPunten(punten: Controlepunt[]): Controlepunt[] {
  return [...punten].sort((a, b) => Number(a.opgelost) - Number(b.opgelost) || Date.parse(b.aangemaakt_op) - Date.parse(a.aangemaakt_op))
}

/** Waar de foto van een nieuw punt komt te staan: een eigen map per project. */
export const fotoPad = (projectId: string, id: string) => `${projectId}/${id}.jpg`

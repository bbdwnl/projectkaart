import type { Controlepunt } from './types'

// Controle: de lijst met aandachtspunten op de projectkaart.

export type ControleFilter = 'open' | 'opgelost' | 'alles'

/** leverancier: een id, 'geen' (nog zonder leverancier) of 'alle'. */
export function pastPunt(p: Controlepunt, filter: ControleFilter, leverancier: string): boolean {
  if (leverancier !== 'alle' && (p.leverancier_id ?? 'geen') !== leverancier) return false
  return filter === 'alles' || (filter === 'open') === !p.opgelost
}

/** Open punten eerst, daarbinnen het nieuwste bovenaan. */
export function sorteerPunten(punten: Controlepunt[]): Controlepunt[] {
  return [...punten].sort((a, b) => Number(a.opgelost) - Number(b.opgelost) || Date.parse(b.aangemaakt_op) - Date.parse(a.aangemaakt_op))
}

/** Waar de foto van een nieuw punt komt te staan: een eigen map per project. */
export const fotoPad = (projectId: string, id: string) => `${projectId}/${id}.jpg`

// ---------- Het overzicht over alle projecten (pagina Controle) ----------

export type Indeling = 'project' | 'leverancier'

export interface PuntGroep {
  /** Een project-id, een leverancier-id, of 'geen' (zonder leverancier). */
  sleutel: string
  titel: string
  punten: Controlepunt[]
}

const sleutelVan = (p: Controlepunt, op: Indeling) => (op === 'project' ? p.project_id : p.leverancier_id ?? 'geen')

/** De punten in groepen per project of per leverancier, op naam; "zonder leverancier" achteraan. */
export function groepeerPunten(punten: Controlepunt[], op: Indeling, naam: (sleutel: string) => string): PuntGroep[] {
  const groepen = new Map<string, Controlepunt[]>()
  for (const p of punten) groepen.set(sleutelVan(p, op), [...(groepen.get(sleutelVan(p, op)) ?? []), p])
  return [...groepen]
    .map(([sleutel, ps]) => ({ sleutel, titel: naam(sleutel), punten: sorteerPunten(ps) }))
    .sort((a, b) => Number(a.sleutel === 'geen') - Number(b.sleutel === 'geen') || a.titel.localeCompare(b.titel, 'nl'))
}

/** Per project of per leverancier: hoeveel punten er open staan, en hoeveel er zijn. */
export function telPunten(punten: Controlepunt[], op: Indeling): Map<string, { open: number, totaal: number }> {
  const tel = new Map<string, { open: number, totaal: number }>()
  for (const p of punten) {
    const t = tel.get(sleutelVan(p, op)) ?? { open: 0, totaal: 0 }
    t.totaal++
    if (!p.opgelost) t.open++
    tel.set(sleutelVan(p, op), t)
  }
  return tel
}

/** "Controle - Apeldoorn Vlijtseweg - Klimaattechniek Oost - 09-10-2026.pdf", zonder tekens die een bestandsnaam breken. */
export function pdfNaam(delen: string[], datum: string): string {
  return `${['Controle', ...delen, datum].map(d => d.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' - ')}.pdf`
}

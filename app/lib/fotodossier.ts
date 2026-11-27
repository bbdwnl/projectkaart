import type { Dossierfoto } from './types'
import { dagenTussen, fmt } from './datum'

// Fotodossier: foto's per project, met een titel als je die opgeeft (beslissing 50).

export interface FotoDag {
  /** "Vandaag", "Gisteren" of "05-10-2026". */
  dag: string
  fotos: Dossierfoto[]
}

/** De foto's per dag waarop ze zijn gemaakt, de nieuwste dag en de nieuwste foto eerst. */
export function perDag(fotos: Dossierfoto[], nu: Date): FotoDag[] {
  const dagen = new Map<string, { dag: Date, fotos: Dossierfoto[] }>()
  for (const f of [...fotos].sort((a, b) => Date.parse(b.aangemaakt_op) - Date.parse(a.aangemaakt_op))) {
    const d = new Date(f.aangemaakt_op)
    const dag = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const sleutel = fmt(dag)
    if (!dagen.has(sleutel)) dagen.set(sleutel, { dag, fotos: [] })
    dagen.get(sleutel)!.fotos.push(f)
  }
  return [...dagen.values()].map(({ dag, fotos }) => {
    const n = dagenTussen(dag, nu)
    return { dag: n === 0 ? 'Vandaag' : n === 1 ? 'Gisteren' : fmt(dag), fotos }
  })
}

/** Het tijdstip onder een foto: "14:05". */
export function tijdVan(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

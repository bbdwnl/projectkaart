import type { Status, Taak } from './types'

export const STATUSSEN: { id: Status, naam: string }[] = [
  { id: 'niet_gestart', naam: 'Niet gestart' },
  { id: 'loopt', naam: 'Loopt' },
  { id: 'concept', naam: 'Concept' },
  { id: 'definitief', naam: 'Definitief' },
  { id: 'volgende_fase', naam: 'Volgende fase' },
  { id: 'nvt', naam: 'N.v.t.' },
]
export const statusNaam = (s: string | null | undefined) => STATUSSEN.find(x => x.id === s)?.naam ?? s ?? ''

export function leegTaak(extra: Partial<Taak> & Pick<Taak, 'id' | 'project_id' | 'fase'>): Taak {
  return {
    lijst: null, sleutel: null, uitzondering_id: null, deadline: null, status: 'niet_gestart', eigenaar: null,
    notitie: null, reden_nvt: null, aanleiding: null, klantakkoord: false, klantakkoord_door: null, klantakkoord_op: null,
    document_url: null, document_naam: null, afgetekend_door: null, afgetekend_op: null, gewijzigd_op: null, gewijzigd_door: null,
    ...extra,
  }
}

/** Een leesbare naam uit een SharePoint-link: het laatste stuk van het pad. */
export function naamUitLink(url: string): string {
  try {
    const pad = new URL(url).pathname.split('/').filter(Boolean)
    return decodeURIComponent(pad.at(-1) ?? url)
  } catch {
    return url
  }
}

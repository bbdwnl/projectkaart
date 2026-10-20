import type { Project } from './types'

// Het adres van een project: je vult postcode en huisnummer in, straat en plaats komen uit de BAG
// (via de Locatieserver van PDOK, gratis en zonder sleutel). Niet gevonden, bijvoorbeeld bij nieuwbouw:
// dan vul je straat en plaats zelf in.

export type AdresVelden = Pick<Project, 'postcode' | 'huisnummer' | 'straat' | 'plaats'>

/** "5222ae" en "5222 AE" worden "5222 AE"; null als het geen Nederlandse postcode is. */
export function normaalPostcode(v: string): string | null {
  const m = v.trim().toUpperCase().match(/^([1-9]\d{3})\s*([A-Z]{2})$/)
  return m ? `${m[1]} ${m[2]}` : null
}

/** Zoals de BAG het schrijft: "8 a" wordt "8A", "8a 1" wordt "8A-1", "12-2" blijft "12-2". Null zonder nummer vooraan. */
export function normaalHuisnummer(v: string): string | null {
  const m = v.trim().toUpperCase().match(/^(\d{1,5})\s*([A-Z])?(?:\s*[-\s]\s*([A-Z0-9]{1,4}))?$/)
  return m ? `${m[1]}${m[2] ?? ''}${m[3] ? `-${m[3]}` : ''}` : null
}

/** Eén regel om te tonen: "Vlijtseweg 12, 7311 AB Apeldoorn". Null als er niets is ingevuld. */
export function adresRegel(a: Partial<AdresVelden>): string | null {
  const straat = [a.straat, a.huisnummer].filter(Boolean).join(' ')
  const plaats = [a.postcode, a.plaats].filter(Boolean).join(' ')
  return [straat, plaats].filter(Boolean).join(', ') || null
}

/** Een adres uit de Locatieserver (alleen de velden die we vragen). */
export interface PdokAdres {
  straatnaam: string
  huis_nlt: string
  postcode: string
  woonplaatsnaam: string
  adresseerbaarobject_id: string
}

export type Opzoeking =
  | { stand: 'gevonden', adres: Required<AdresVelden>, bagId: string }
  | { stand: 'niet_gevonden', varianten: string[] }
  | { stand: 'fout' }

/** Het adres met precies dit huisnummer; anders de huisnummers die er wel zijn, om uit te kiezen. */
export function kiesAdres(docs: PdokAdres[], huisnummer: string): Opzoeking {
  const d = docs.find(x => x.huis_nlt.toUpperCase() === huisnummer)
  if (d) return { stand: 'gevonden', adres: { postcode: normaalPostcode(d.postcode) ?? d.postcode, huisnummer: d.huis_nlt, straat: d.straatnaam, plaats: d.woonplaatsnaam }, bagId: d.adresseerbaarobject_id }
  const varianten = [...new Set(docs.map(x => x.huis_nlt))].sort((a, b) => a.localeCompare(b, 'nl', { numeric: true })).slice(0, 6)
  return { stand: 'niet_gevonden', varianten }
}

const PDOK = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free'

/** Het object in de BAG Viewer van het Kadaster: het adres op de kaart, met pand, gebruiksdoel en oppervlakte. */
export const bagViewer = (bagId: string) => `https://bagviewer.kadaster.nl/lvbag/bag-viewer/?objectId=${encodeURIComponent(bagId)}`

/** Zoekt postcode en huisnummer (allebei al normaal) op in de BAG. */
export async function zoekAdres(postcode: string, huisnummer: string): Promise<Opzoeking> {
  const q = new URLSearchParams({
    q: `postcode:${postcode.replace(' ', '')} and huisnummer:${Number.parseInt(huisnummer, 10)}`,
    fq: 'type:adres',
    fl: 'straatnaam,huis_nlt,postcode,woonplaatsnaam,adresseerbaarobject_id',
    rows: '50',
  })
  try {
    const res = await fetch(`${PDOK}?${q}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return { stand: 'fout' }
    const json = await res.json() as { response?: { docs?: PdokAdres[] } }
    return kiesAdres(json.response?.docs ?? [], huisnummer)
  } catch {
    return { stand: 'fout' }
  }
}

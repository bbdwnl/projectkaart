import type { Fase, Licht, Project, Rol, Taak, Uitzondering } from './types'
import { faseInfo } from './fasen'
import { ORDE, samen, takenVan, telling, volgendeMijlpaal } from './stoplicht'

// De overzichten Projecten (drie kolommen) en Haalbaarheid: per project een kaartje met het nummer, de naam,
// de kleurenbalk van de taken in de huidige fase en de voornaam van wie in die fase verantwoordelijk is.

/** De kolommen op Projecten. Leads en haalbaarheid hebben een eigen pagina. */
export const KOLOMMEN: Fase[] = ['ontwikkeling', 'uitvoering', 'nazorg']

export interface Kaartje {
  p: Project
  t: Record<Licht, number>
  licht: Licht
  /** De rol die in deze fase verantwoordelijk is: AM, PO of PM. */
  rol: Rol
  /** Alleen de voornaam, of null als er nog niemand is gekozen. */
  wie: string | null
}

export const voornaam = (naam: string | null | undefined) => naam?.trim().split(/\s+/)[0] || null

/** Het dringendste eerst: te laat, dan let op; daarbinnen de meeste taken te laat en de eerstvolgende mijlpaal. */
export function kaartjesVan(projecten: Project[], taken: Taak[], catalogus: Uitzondering[], nu: Date): Kaartje[] {
  return projecten.map((p) => {
    const regels = takenVan(p.fase, p, taken.filter(t => t.project_id === p.id), catalogus, nu)
    const rol = faseInfo(p.fase).rol
    return { p, t: telling(regels), licht: samen(regels.map(r => r.b.licht)), rol, wie: voornaam(p[rol]), dagen: volgendeMijlpaal(p, nu)?.dagen ?? 1e6 }
  })
    .sort((a, b) => ORDE[a.licht] - ORDE[b.licht] || b.t.telaat - a.t.telaat || b.t.letop - a.t.letop || a.dagen - b.dagen || a.p.naam.localeCompare(b.p.naam, 'nl'))
    .map(({ dagen: _, ...k }) => k)
}

export type Sortering = 'telaat' | 'naam' | 'inkoop'
export const SORTERINGEN: { id: Sortering, naam: string }[] = [
  { id: 'telaat', naam: 'Meeste te laat' },
  { id: 'naam', naam: 'Alfabetisch' },
  { id: 'inkoop', naam: 'Inkoop gereed' },
]
export const leesSortering = (v: unknown): Sortering => SORTERINGEN.find(s => s.id === v)?.id ?? 'telaat'

/**
 * Meeste te laat: de volgorde van kaartjesVan. Alfabetisch: op naam. Inkoop gereed: de vroegste datum inkoop gereed
 * eerst, zonder datum achteraan.
 */
export function sorteerKaartjes(kaartjes: Kaartje[], op: Sortering): Kaartje[] {
  if (op === 'telaat') return kaartjes
  const naam = (a: Kaartje, b: Kaartje) => a.p.naam.localeCompare(b.p.naam, 'nl')
  if (op === 'naam') return [...kaartjes].sort(naam)
  const inkoop = (k: Kaartje) => k.p.datum_inkoop ?? '9999'
  return [...kaartjes].sort((a, b) => inkoop(a).localeCompare(inkoop(b)) || naam(a, b))
}

/** Filter op wie verantwoordelijk is: een voornaam, 'geen' (nog niemand gekozen) of 'alle'. */
export const pastWie = (k: Kaartje, wie: string) => wie === 'alle' || (k.wie ?? 'geen') === wie

/** Filter op projectleider of opzichter: een voornaam, 'geen' of 'alle'. */
export const pastPersoon = (naam: string | null | undefined, filter: string) => filter === 'alle' || (voornaam(naam) ?? 'geen') === filter

/** De namen in een veld (projectleider, opzichter), met hoeveel projecten; "geen" achteraan. De gekozen naam staat er altijd bij. */
export function namenVan(kaartjes: Kaartje[], veld: 'pm' | 'opzichter', gekozen: string): { id: string, aantal: number }[] {
  const van = (k: Kaartje) => voornaam(k.p[veld]) ?? 'geen'
  const namen = new Set(kaartjes.map(van))
  if (gekozen !== 'alle') namen.add(gekozen)
  return [...namen]
    .sort((a, b) => Number(a === 'geen') - Number(b === 'geen') || a.localeCompare(b, 'nl'))
    .map(id => ({ id, aantal: kaartjes.filter(k => van(k) === id).length }))
}

/** De mensen om op te filteren, op naam, met hoeveel projecten; "zonder" achteraan. De gekozen naam staat er altijd bij. */
export function personen(kaartjes: Kaartje[], gekozen: string): { id: string, aantal: number }[] {
  const namen = new Set(kaartjes.map(k => k.wie ?? 'geen'))
  if (gekozen !== 'alle') namen.add(gekozen)
  return [...namen]
    .sort((a, b) => Number(a === 'geen') - Number(b === 'geen') || a.localeCompare(b, 'nl'))
    .map(id => ({ id, aantal: kaartjes.filter(k => (k.wie ?? 'geen') === id).length }))
}

/** Zoeken op naam, projectnummer, plaats of wie verantwoordelijk is. */
export function vindt(k: Kaartje, zoek: string): boolean {
  const z = zoek.trim().toLowerCase()
  return !z || [k.p.naam, k.p.nummer, k.p.plaats, k.wie].filter(Boolean).join(' ').toLowerCase().includes(z)
}

/** De kleurenbalk in woorden: voor de tooltip en voor schermlezers (een stand nooit alleen als kleur). */
export function balkTekst(t: Record<Licht, number>): string {
  const delen = [t.telaat && `${t.telaat} te laat`, t.letop && `${t.letop} let op`, t.klaar && `${t.klaar} klaar`, t.open && `${t.open} open`].filter(Boolean)
  return delen.length ? `Taken: ${delen.join(', ')}` : 'Nog geen taken in deze fase'
}

import type { Fase, Licht, Project, Rol, Taak, Uitzondering } from './types'
import { faseInfo, ROLLEN, SUBFASEN } from './fasen'
import { ORDE, samen, takenVan, telling, volgendeMijlpaal, type Mijlpaal } from './stoplicht'

// Het overzicht Projecten (vier kolommen, van haalbaarheid tot nazorg): per project een kaartje met het nummer, de naam,
// de kleurenbalk van de taken in de huidige fase en de voornaam van wie in die fase verantwoordelijk is.

/** De kolommen op Projecten. Leads staan onder Acquisitie. */
export const KOLOMMEN: Fase[] = ['haalbaarheid', 'ontwikkeling', 'uitvoering', 'nazorg']

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

/** Nazorg die helemaal klaar is. Alleen in nazorg: gaat een project terug, dan telt het weer gewoon mee. */
export const isAfgehandeld = (p: Pick<Project, 'fase' | 'afgehandeld'>) => p.fase === 'nazorg' && p.afgehandeld

export type Sortering = 'telaat' | 'naam' | 'inkoop' | 'afbouw'
export const SORTERINGEN: { id: Sortering, naam: string }[] = [
  { id: 'telaat', naam: 'Meeste te laat' },
  { id: 'naam', naam: 'Alfabetisch' },
  { id: 'inkoop', naam: 'Inkoop gereed' },
  { id: 'afbouw', naam: 'Start afbouw' },
]
/** De datum waarop gesorteerd wordt; die staat dan ook op het kaartje. */
export const SORTEERDATUM: Partial<Record<Sortering, { naam: string, veld: 'datum_inkoop' | 'datum_afbouw' }>> = {
  inkoop: { naam: 'Inkoop gereed', veld: 'datum_inkoop' },
  afbouw: { naam: 'Start afbouw', veld: 'datum_afbouw' },
}
export const leesSortering = (v: unknown): Sortering => SORTERINGEN.find(s => s.id === v)?.id ?? 'telaat'

/**
 * Meeste te laat: de volgorde van kaartjesVan. Alfabetisch: op naam. Inkoop gereed en start afbouw: de vroegste
 * datum eerst, zonder datum achteraan.
 */
export function sorteerKaartjes(kaartjes: Kaartje[], op: Sortering): Kaartje[] {
  if (op === 'telaat') return kaartjes
  const naam = (a: Kaartje, b: Kaartje) => a.p.naam.localeCompare(b.p.naam, 'nl')
  if (op === 'naam') return [...kaartjes].sort(naam)
  const veld = SORTEERDATUM[op]!.veld
  const datum = (k: Kaartje) => k.p[veld] ?? '9999'
  return [...kaartjes].sort((a, b) => datum(a).localeCompare(datum(b)) || naam(a, b))
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

/** De extra regels van een kaartje in de weergave Zakelijk (beslissing 45). */
export interface KaartjeInfo {
  /** Plaats en, in haalbaarheid, de subfase. Leeg als die er geen van beide zijn. */
  waar: string
  /** Wie verantwoordelijk is, en ook de PM en de opzichter als die er zijn: alleen de voornaam. */
  mensen: { rol: string, naam: string }[]
  mijlpaal: Mijlpaal | null
  /** Taken in deze fase die meetellen (zonder n.v.t.). */
  totaal: number
}

export function kaartjeInfo(k: Kaartje, nu: Date): KaartjeInfo {
  const p = k.p
  const subfase = p.fase === 'haalbaarheid' ? SUBFASEN.find(s => s.id === p.subfase)?.naam : null
  const rollen = [k.rol, ...(['pm', 'opzichter'] as const).filter(r => r !== k.rol)]
  return {
    waar: [p.plaats, subfase].filter(Boolean).join(' · '),
    mensen: rollen.flatMap(r => { const naam = voornaam(p[r]); return naam ? [{ rol: ROLLEN[r].kort, naam }] : [] }),
    mijlpaal: volgendeMijlpaal(p, nu),
    totaal: k.t.telaat + k.t.letop + k.t.open + k.t.klaar,
  }
}

/** Hoe ver een datum weg is, kort: "over 12 d", "vandaag", "3 d geleden". */
export function dagenKort(dagen: number): string {
  if (dagen === 0) return 'vandaag'
  return dagen > 0 ? `over ${dagen} d` : `${-dagen} d geleden`
}

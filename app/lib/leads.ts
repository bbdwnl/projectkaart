import type { Licht, Project, Taak, Uitzondering } from './types'
import { samen, takenVan } from './stoplicht'

// Het leadsoverzicht: alle projecten in de fase lead, met filters en sortering.
// Relatieve imports: de proefversie maakt hiermee ook voorbeeldleads op de server.

/** De slagingskans zoals de database hem toestaat. */
export const SLAGINGSKANSEN = [0, 25, 50, 75, 100] as const

export type KansGroep = 'hoog' | 'midden' | 'laag' | 'onbekend'
export const KANSGROEPEN: { id: KansGroep, naam: string }[] = [
  { id: 'hoog', naam: '75–100%' },
  { id: 'midden', naam: '50%' },
  { id: 'laag', naam: '0–25%' },
  { id: 'onbekend', naam: 'Onbekend' },
]

export function kansGroep(kans: number | null): KansGroep {
  if (kans === null) return 'onbekend'
  return kans >= 75 ? 'hoog' : kans >= 50 ? 'midden' : 'laag'
}

/** Eén regel in het overzicht. */
export interface Lead {
  p: Project
  /** De stand van de overdracht naar haalbaarheid: de taken van de fase lead samen. */
  licht: Licht
  /** Wat nog niet klaar is voor de overdracht. */
  open: string[]
  /** De laatste wijziging aan het project of aan een van zijn taken, of null. */
  laatst: string | null
}

export function leadsVan(projecten: Project[], taken: Taak[], catalogus: Uitzondering[], nu: Date): Lead[] {
  return projecten.filter(p => p.fase === 'lead').map((p) => {
    const eigen = taken.filter(t => t.project_id === p.id)
    const regels = takenVan('lead', p, eigen, catalogus, nu)
    const momenten = [p.gewijzigd_op, ...eigen.map(t => t.gewijzigd_op)].filter((m): m is string => !!m)
    return {
      p,
      licht: samen(regels.map(r => r.b.licht)),
      open: regels.filter(r => r.b.licht !== 'klaar' && r.b.licht !== 'later').map(r => r.titel),
      laatst: momenten.length ? momenten.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)) : null,
    }
  })
}

export interface LeadFilter {
  zoek: string
  /** Een naam, 'geen' (nog geen accountmanager) of 'alle'. */
  am: string
  kans: KansGroep | 'alle'
  prio: boolean
  /** Alleen leads die klaar zijn voor de overdracht naar haalbaarheid. */
  klaar: boolean
}

export const GEEN_FILTER: Readonly<LeadFilter> = { zoek: '', am: 'alle', kans: 'alle', prio: false, klaar: false }

export const amVan = (l: Lead) => l.p.am ?? 'geen'

export function past(l: Lead, f: LeadFilter): boolean {
  const z = f.zoek.trim().toLowerCase()
  if (z && ![l.p.naam, l.p.plaats, l.p.nummer, l.p.afas_nummer, l.p.adres, l.p.am].filter(Boolean).join(' ').toLowerCase().includes(z)) return false
  if (f.am !== 'alle' && amVan(l) !== f.am) return false
  if (f.kans !== 'alle' && kansGroep(l.p.slagingskans) !== f.kans) return false
  if (f.prio && !l.p.prio) return false
  if (f.klaar && l.licht !== 'klaar') return false
  return true
}

export type LeadKolom = 'kans' | 'naam' | 'am' | 'm2' | 'laatst'
export interface Sortering { kolom: LeadKolom, af: boolean }

/** De richting als je een kolom kiest: kans, oppervlakte en laatste wijziging met de hoogste of nieuwste eerst. */
export const AFLOPEND: Record<LeadKolom, boolean> = { kans: true, naam: false, am: false, m2: true, laatst: true }
const KOLOMMEN = Object.keys(AFLOPEND) as LeadKolom[]
export const STANDAARD_SORTERING: Readonly<Sortering> = { kolom: 'kans', af: true }

/** Lege waarden staan altijd onderaan. Bij gelijke stand: prio eerst, dan op naam. */
export function sorteer(leads: Lead[], s: Sortering): Lead[] {
  const waarde = (l: Lead): string | number | null => {
    switch (s.kolom) {
      case 'kans': return l.p.slagingskans
      case 'naam': return l.p.naam
      case 'am': return l.p.am
      case 'm2': return l.p.m2
      case 'laatst': return l.laatst ? Date.parse(l.laatst) : null
    }
  }
  return [...leads].sort((a, b) => {
    const x = waarde(a), y = waarde(b)
    if (x !== y) {
      if (x === null) return 1
      if (y === null) return -1
      const c = typeof x === 'string' ? x.localeCompare(String(y), 'nl') : x - Number(y)
      if (c) return s.af ? -c : c
    }
    return Number(b.p.prio) - Number(a.p.prio) || a.p.naam.localeCompare(b.p.naam, 'nl')
  })
}

const tekst = (v: unknown): string => typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : ''

/** Filters en sortering uit de adresbalk. Onbekende waarden worden de standaard. */
export function leesQuery(q: Record<string, unknown>): { filter: LeadFilter, sortering: Sortering } {
  const kans = tekst(q.kans)
  const kolom = KOLOMMEN.find(k => k === tekst(q.sort)) ?? STANDAARD_SORTERING.kolom
  const richting = tekst(q.richting)
  return {
    filter: {
      zoek: tekst(q.zoek),
      am: tekst(q.am) || 'alle',
      kans: KANSGROEPEN.find(k => k.id === kans)?.id ?? 'alle',
      prio: tekst(q.prio) === '1',
      klaar: tekst(q.klaar) === '1',
    },
    sortering: { kolom, af: richting === 'op' ? false : richting === 'af' ? true : AFLOPEND[kolom] },
  }
}

/** Het omgekeerde van leesQuery; wat op de standaard staat, blijft weg. */
export function naarQuery(f: LeadFilter, s: Sortering): Record<string, string> {
  const q: Record<string, string> = {}
  if (f.zoek.trim()) q.zoek = f.zoek
  if (f.am !== 'alle') q.am = f.am
  if (f.kans !== 'alle') q.kans = f.kans
  if (f.prio) q.prio = '1'
  if (f.klaar) q.klaar = '1'
  if (s.kolom !== STANDAARD_SORTERING.kolom) q.sort = s.kolom
  if (s.af !== AFLOPEND[s.kolom]) q.richting = s.af ? 'af' : 'op'
  return q
}

/** Een slug uit de naam, uniek tussen de bestaande: "Zorgplein Noord" wordt "zorgplein-noord", daarna "-2". */
export function maakSlug(naam: string, bestaand: string[]): string {
  const basis = naam.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'lead'
  const bezet = new Set(bestaand)
  let slug = basis
  for (let i = 2; bezet.has(slug); i++) slug = `${basis}-${i}`
  return slug
}

export type NieuweLead = Pick<Project, 'slug' | 'naam' | 'plaats' | 'afas_nummer' | 'am' | 'slagingskans'>

/** Een volledig project in de fase lead, voor de proefversie. */
export function leegProject(extra: Partial<Project> & Pick<Project, 'id' | 'slug' | 'naam'>): Project {
  return {
    nummer: null, afas_nummer: null, plaats: null, adres: null, fase: 'lead', prio: false, soort: [], m2: null,
    slagingskans: null, am: null, po: null, pm: null, opzichter: null,
    datum_casco: null, datum_voorbereiding: null, datum_inkoop: null, datum_afbouw: null, datum_oplevering: null,
    sharepoint_url: null, extern_url: null, notitieblok_url: null, tekeningen_locatie: null, gewijzigd_op: null,
    ...extra,
  }
}

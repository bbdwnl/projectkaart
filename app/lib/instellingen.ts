import type { Fase, Rol, Status } from './types'
import { BUDDIES, DISCIPLINES, EIGENAREN, EISEN, FASEN, MENSEN, ROLLEN, SOORTEN, SUBFASEN, type Eis } from './fasen'
import { LIJSTEN, type DeadlineRegel, type Takengroep } from './taken'
import { STATUSSEN } from './taak'

// De keuzelijsten onder Instellingen (alleen het MT past ze aan). In de database één rij per lijst, de inhoud als JSON
// (tabel instellingen). De lijsten in de code zijn de standaard: zonder rij, of met een rij die niet klopt, geldt die.
// pasToe zet de versie uit de database over de lijsten in de code heen, op hun plek, zodat elk scherm meegaat.
//
// Waar de app mee rekent, ligt vast: de statussen en de fasen (alleen de namen en de kleur zijn aan te passen), de
// rollen en de soorten deadline. De rest is vrij: wie welke rol kan hebben, soorten, subfasen, disciplines, het takenpakket en wat
// er bij elke overdracht klaar moet zijn.

export const FASE_IDS: Fase[] = ['lead', 'haalbaarheid', 'ontwikkeling', 'uitvoering', 'nazorg']
export const ROL_IDS: Rol[] = ['am', 'po', 'pm', 'opzichter']
export const STATUS_IDS: Status[] = ['niet_gestart', 'loopt', 'concept', 'definitief', 'volgende_fase', 'nvt']

export interface Keuze { id: string, naam: string }

export interface Instellingen {
  mensen: { rollen: Record<Rol, string[]>, eigenaren: string[], buddies: string[] }
  labels: {
    statussen: Record<Status, string>
    fasen: Record<Fase, { naam: string, wat: string, kleur: string }>
    rollen: Record<Rol, { kort: string, naam: string }>
    subfasen: Keuze[]
    soorten: Keuze[]
    disciplines: Keuze[]
  }
  takenpakket: Record<Fase, Takengroep[]>
  overdracht: Record<Fase, { kop: string, items: Eis[] }>
}
export type Sleutel = keyof Instellingen
export const SLEUTELS: Sleutel[] = ['mensen', 'labels', 'takenpakket', 'overdracht']

/** De soorten deadline, met hoe je ze leest; de getallen zijn dagen (bij inkoop: weken). */
export const REGELTYPES: { type: DeadlineRegel['type'], naam: string, eenheid: 'dagen' | 'weken' }[] = [
  { type: 'voorbereiding', naam: 'vóór start voorbereiding', eenheid: 'dagen' },
  { type: 'inkoop', naam: 'vóór inkoop gereed', eenheid: 'weken' },
  { type: 'afbouw', naam: 'vóór start afbouw', eenheid: 'dagen' },
  { type: 'oplevering', naam: 'ná oplevering', eenheid: 'dagen' },
]

/** Wat er nu in de lijsten staat (los van de reactive lijsten zelf: een kopie om te bewerken). */
export function huidig(): Instellingen {
  const kopie = <T>(v: T): T => JSON.parse(JSON.stringify(v))
  const per = <K extends string, V>(ids: K[], f: (id: K) => V) => Object.fromEntries(ids.map(id => [id, f(id)])) as Record<K, V>
  return kopie({
    mensen: { rollen: per(ROL_IDS, r => MENSEN[r]), eigenaren: EIGENAREN, buddies: BUDDIES },
    labels: {
      statussen: per(STATUS_IDS, s => STATUSSEN.find(x => x.id === s)!.naam),
      fasen: per(FASE_IDS, f => { const i = FASEN.find(x => x.id === f)!; return { naam: i.naam, wat: i.wat, kleur: i.kleur } }),
      rollen: per(ROL_IDS, r => ROLLEN[r]),
      subfasen: SUBFASEN,
      soorten: SOORTEN,
      disciplines: DISCIPLINES,
    },
    takenpakket: per(FASE_IDS, f => LIJSTEN[f]),
    overdracht: per(FASE_IDS, f => EISEN[f]),
  })
}

/** De lijsten uit de code, vastgelegd voordat er iets overheen is gezet. */
const STANDAARD = huidig()
export const standaard = (): Instellingen => JSON.parse(JSON.stringify(STANDAARD))

// ---------- controleren ----------

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
/** Een getrimde tekst van 1 tot max tekens, anders null. */
const tekst = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim().replace(/\s+/g, ' ') : null)
const CODE = /^[a-z0-9_]{1,40}$/
const SLEUTEL = /^[a-z0-9_]{1,60}$/
/** Een kleur in hex, zoals een kleurkiezer hem geeft. */
const KLEUR = /^#[0-9a-f]{6}$/i

/** Namen: getrimd, zonder dubbele (hoofdletters tellen niet), hoogstens 100. */
function namen(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  const uit: string[] = []
  for (const n of v) {
    const t = tekst(n, 80)
    if (t && !uit.some(x => x.toLowerCase() === t.toLowerCase())) uit.push(t)
  }
  return uit.slice(0, 100)
}

/** Keuzes met een code en een naam; een code komt één keer voor. */
function keuzes(v: unknown): Keuze[] | null {
  if (!Array.isArray(v)) return null
  const uit: Keuze[] = []
  for (const k of v) {
    if (!isObject(k) || typeof k.id !== 'string' || !CODE.test(k.id)) continue
    const naam = tekst(k.naam, 80)
    if (naam && !uit.some(x => x.id === k.id)) uit.push({ id: k.id, naam })
  }
  return uit.slice(0, 100)
}

function regel(v: unknown): DeadlineRegel | undefined {
  if (!isObject(v)) return undefined
  const getal = (x: unknown, max: number) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= max ? x : null)
  switch (v.type) {
    case 'inkoop': { const w = getal(v.weken, 104); return w === null ? undefined : { type: 'inkoop', weken: w, ...(v.casco === true ? { casco: true } : {}) } }
    case 'voorbereiding': case 'afbouw': case 'oplevering': { const d = getal(v.dagen, 730); return d === null ? undefined : { type: v.type, dagen: d } }
    default: return undefined
  }
}

/** Per fase de groepen met taken. Een sleutel komt in een fase één keer voor; de eerste telt. */
function pakket(v: unknown): Takengroep[] | null {
  if (!Array.isArray(v)) return null
  const gezien = new Set<string>()
  const uit: Takengroep[] = []
  for (const g of v.slice(0, 40)) {
    if (!isObject(g) || !Array.isArray(g.taken)) continue
    const titel = tekst(g.titel, 120)
    if (!titel) continue
    const taken = []
    for (const t of g.taken.slice(0, 200)) {
      if (!isObject(t) || typeof t.sleutel !== 'string' || !SLEUTEL.test(t.sleutel) || gezien.has(t.sleutel)) continue
      const tt = tekst(t.titel, 200)
      if (!tt) continue
      gezien.add(t.sleutel)
      const r = regel(t.regel)
      taken.push({ sleutel: t.sleutel, titel: tt, ...(r ? { regel: r } : {}) })
    }
    const uitleg = tekst(g.uitleg, 200)
    uit.push({ titel, ...(uitleg ? { uitleg } : {}), taken })
  }
  return uit
}

function overdracht(v: unknown): { kop: string, items: Eis[] } | null {
  if (!isObject(v) || !Array.isArray(v.items)) return null
  const kop = tekst(v.kop, 60)
  if (!kop) return null
  const items: Eis[] = []
  for (const i of v.items.slice(0, 40)) {
    if (!isObject(i) || !Array.isArray(i.taken)) continue
    const titel = tekst(i.titel, 120)
    const taken = [...new Set(i.taken.filter((k): k is string => typeof k === 'string'
      && FASE_IDS.includes(k.split(':')[0] as Fase) && SLEUTEL.test(k.split(':')[1] ?? '') && k.split(':').length === 2))]
    if (titel) items.push({ titel, taken })
  }
  return { kop, items }
}

/**
 * Een rij uit de database, gecontroleerd; wat er ontbreekt of niet klopt, komt uit de standaard. Zo kan een
 * verkeerde rij de app nooit stilleggen.
 */
export function lees<S extends Sleutel>(sleutel: S, waarde: unknown): Instellingen[S] {
  const std = standaard()[sleutel]
  if (!isObject(waarde)) return std
  const w = waarde
  switch (sleutel) {
    case 'mensen': {
      const s = std as Instellingen['mensen']
      const rollen = isObject(w.rollen) ? w.rollen : {}
      return {
        rollen: Object.fromEntries(ROL_IDS.map(r => [r, namen(rollen[r]) ?? s.rollen[r]])),
        eigenaren: namen(w.eigenaren) ?? s.eigenaren,
        buddies: namen(w.buddies) ?? s.buddies,
      } as Instellingen[S]
    }
    case 'labels': {
      const s = std as Instellingen['labels']
      const st = isObject(w.statussen) ? w.statussen : {}
      const fa = isObject(w.fasen) ? w.fasen : {}
      const ro = isObject(w.rollen) ? w.rollen : {}
      return {
        statussen: Object.fromEntries(STATUS_IDS.map(id => [id, tekst(st[id], 40) ?? s.statussen[id]])),
        fasen: Object.fromEntries(FASE_IDS.map((id) => {
          const f = isObject(fa[id]) ? fa[id] : {}
          return [id, { naam: tekst(f.naam, 40) ?? s.fasen[id].naam, wat: tekst(f.wat, 80) ?? s.fasen[id].wat, kleur: KLEUR.test(`${f.kleur}`) ? `${f.kleur}` : s.fasen[id].kleur }]
        })),
        rollen: Object.fromEntries(ROL_IDS.map((id) => {
          const r = isObject(ro[id]) ? ro[id] : {}
          return [id, { kort: tekst(r.kort, 20) ?? s.rollen[id].kort, naam: tekst(r.naam, 60) ?? s.rollen[id].naam }]
        })),
        subfasen: keuzes(w.subfasen) ?? s.subfasen,
        soorten: keuzes(w.soorten) ?? s.soorten,
        disciplines: keuzes(w.disciplines) ?? s.disciplines,
      } as Instellingen[S]
    }
    case 'takenpakket': {
      const s = std as Instellingen['takenpakket']
      return Object.fromEntries(FASE_IDS.map(f => [f, pakket(w[f]) ?? s[f]])) as Instellingen[S]
    }
    default: {
      const s = std as Instellingen['overdracht']
      return Object.fromEntries(FASE_IDS.map(f => [f, overdracht(w[f]) ?? s[f]])) as Instellingen[S]
    }
  }
}

// ---------- toepassen ----------

const vervang = <T>(lijst: T[], nieuw: T[]) => { lijst.splice(0, lijst.length, ...nieuw) }

/**
 * Zet de lijsten uit de database over de lijsten in de code heen, op hun plek (de schermen houden dezelfde
 * verwijzing). Een sleutel zonder rij krijgt de standaard terug.
 */
export function pasToe(rijen: { sleutel: string, waarde: unknown }[]) {
  const van = <S extends Sleutel>(s: S): Instellingen[S] => {
    const rij = rijen.find(r => r.sleutel === s)
    return rij ? lees(s, rij.waarde) : standaard()[s]
  }
  const m = van('mensen')
  for (const r of ROL_IDS) vervang(MENSEN[r], m.rollen[r])
  vervang(EIGENAREN, m.eigenaren)
  vervang(BUDDIES, m.buddies)

  const l = van('labels')
  for (const s of STATUSSEN) s.naam = l.statussen[s.id]
  for (const f of FASEN) Object.assign(f, l.fasen[f.id])
  for (const r of ROL_IDS) Object.assign(ROLLEN[r], l.rollen[r])
  vervang(SUBFASEN, l.subfasen)
  vervang(SOORTEN, l.soorten)
  vervang(DISCIPLINES, l.disciplines)

  const t = van('takenpakket')
  for (const f of FASE_IDS) vervang(LIJSTEN[f], t[f])

  const o = van('overdracht')
  for (const f of FASE_IDS) {
    EISEN[f].kop = o[f].kop
    vervang(EISEN[f].items, o[f].items)
  }
}

// ---------- hulp bij bewerken ----------

/** Een nieuwe code of sleutel uit een naam: kleine letters en _, uniek naast wat er al is. */
export function nieuweCode(naam: string, bestaand: string[], max = 40): string {
  const basis = naam.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max - 4) || 'item'
  let code = basis
  for (let i = 2; bestaand.includes(code); i++) code = `${basis}_${i}`
  return code
}

/** Alle sleutels van een fase in het pakket (over alle groepen). */
export const sleutelsVan = (groepen: Takengroep[]) => groepen.flatMap(g => g.taken.map(t => t.sleutel))

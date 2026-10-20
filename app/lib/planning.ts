import type { Fase, Project, Rol } from './types'
import { DATUMVELDEN, faseInfo, PROGNOSEVELDEN } from './fasen'
import { naarDatum } from './datum'
import { voornaam } from './overzicht'

// Het planningsoverzicht van Projecten en Haalbaarheid: per project een balk in de tijd, per verantwoordelijke onder
// elkaar, en bovenaan per maand hoeveel projecten er lopen. Twee lagen: lopend (de harde datums van projecten in
// ontwikkeling, uitvoering en nazorg) en prognose (de verwachting van projecten in haalbaarheid). Samen laten ze zien
// waar nieuw werk samenvalt met wat er al loopt.

export type Laag = 'lopend' | 'prognose'
/** De fasen per laag. */
export const LAAG_FASEN: Record<Laag, Fase[]> = { lopend: ['ontwikkeling', 'uitvoering', 'nazorg'], prognose: ['haalbaarheid'] }

/** Drie stappen in de tijd, in de kleur van de laag van licht naar donker. */
export type Stap = 0 | 1 | 2
export const STAPPEN: Record<Laag, [string, string, string]> = {
  lopend: ['Voorbereiding en casco', 'Inkoop gereed → start afbouw', 'Afbouw → oplevering'],
  prognose: ['Haalbaarheid', 'Casco', 'Afbouw → oplevering'],
}

export interface Segment { van: Date, tot: Date, stap: Stap, naam: string }
export interface PlanRegel {
  p: Project
  laag: Laag
  rol: Rol
  /** Voornaam van wie in deze fase verantwoordelijk is, of null. */
  wie: string | null
  segmenten: Segment[]
}

const STAP_VANAF: Record<string, Stap> = {
  datum_casco: 0, datum_voorbereiding: 0, datum_inkoop: 1, datum_afbouw: 2,
  prognose_casco: 1, prognose_afbouw: 2,
}

/** Van elke datum naar de volgende: zo overlappen de stukken nooit, net als op de tijdlijn van de kaart. */
function tussen(punten: { veld: string, naam: string, datum: Date }[]): Segment[] {
  const s = [...punten].sort((a, b) => a.datum.getTime() - b.datum.getTime())
  return s.slice(0, -1).flatMap((a, i) => {
    const b = s[i + 1]!
    if (b.datum <= a.datum) return []
    return [{ van: a.datum, tot: b.datum, stap: STAP_VANAF[a.veld] ?? 0, naam: `${a.naam} → ${b.naam.toLowerCase()}` }]
  })
}

function punten(p: Project, velden: { veld: string, naam: string }[]) {
  return velden.flatMap(v => {
    const datum = naarDatum(p[v.veld as keyof Project] as string | null)
    return datum ? [{ veld: v.veld, naam: v.naam, datum }] : []
  })
}

/** Lopend: de harde datums. Prognose: haalbaarheid tot de eerste prognosedatum, daarna casco en afbouw. */
export function segmentenVan(p: Project, laag: Laag, nu: Date): Segment[] {
  if (laag === 'lopend') return tussen(punten(p, DATUMVELDEN))
  const prognose = punten(p, PROGNOSEVELDEN)
  const eerste = prognose.reduce<(typeof prognose)[number] | null>((m, x) => (!m || x.datum < m.datum ? x : m), null)
  const nog = eerste && eerste.datum > nu ? [{ van: nu, tot: eerste.datum, stap: 0 as Stap, naam: `Haalbaarheid → ${eerste.naam.toLowerCase()}` }] : []
  return [...nog, ...tussen(prognose)]
}

export function planRegels(projecten: Project[], nu: Date): PlanRegel[] {
  return projecten.flatMap((p) => {
    const laag = (Object.keys(LAAG_FASEN) as Laag[]).find(l => LAAG_FASEN[l].includes(p.fase))
    if (!laag) return []
    const rol = faseInfo(p.fase).rol
    return [{ p, laag, rol, wie: voornaam(p[rol]), segmenten: segmentenVan(p, laag, nu) }]
  })
}

export const begin = (r: PlanRegel) => r.segmenten.reduce((m, s) => Math.min(m, s.van.getTime()), Infinity)
export const eind = (r: PlanRegel) => r.segmenten.reduce((m, s) => Math.max(m, s.tot.getTime()), -Infinity)

const maand = (j: number, m: number) => new Date(j, m, 1)

/**
 * De tijdas: vanaf de vorige maand tot de laatste einddatum, minstens anderhalf jaar en hoogstens drie jaar.
 * pos geeft de plek van een datum in procenten.
 */
export function tijdas(regels: PlanRegel[], nu: Date) {
  const van = maand(nu.getFullYear(), nu.getMonth() - 1)
  const laatste = Math.max(...regels.map(eind), maand(nu.getFullYear(), nu.getMonth() + 17).getTime())
  const l = new Date(laatste)
  const tot = new Date(Math.min(maand(l.getFullYear(), l.getMonth() + 1).getTime(), maand(van.getFullYear(), van.getMonth() + 36).getTime()))
  const maanden: Date[] = []
  for (let d = van; d < tot; d = maand(d.getFullYear(), d.getMonth() + 1)) maanden.push(d)
  const pos = (d: Date) => Math.max(0, Math.min(100, (d.getTime() - van.getTime()) / (tot.getTime() - van.getTime()) * 100))
  return { van, tot, maanden, pos }
}

/**
 * Per maand hoeveel projecten er lopen, per laag: een project telt mee als een stuk van zijn balk in die maand valt.
 * Een prognose telt pas vanaf de start van de bouw (casco), niet in de haalbaarheid ervoor: zo zie je waar nieuwe bouw
 * samenvalt met wat er al loopt.
 */
export function bezetting(regels: PlanRegel[], maanden: Date[]): { maand: Date, lopend: number, prognose: number }[] {
  return maanden.map((m) => {
    const volgend = maand(m.getFullYear(), m.getMonth() + 1)
    const loopt = regels.filter(r => r.segmenten.some(s => s.van < volgend && s.tot > m && (r.laag === 'lopend' || s.stap > 0)))
    return { maand: m, lopend: loopt.filter(r => r.laag === 'lopend').length, prognose: loopt.filter(r => r.laag === 'prognose').length }
  })
}

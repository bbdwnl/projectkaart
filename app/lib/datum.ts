import type { IsoDatum } from './types'

const DAG = 864e5

/** 'YYYY-MM-DD' naar een lokale datum om middernacht. */
export function naarDatum(iso: IsoDatum | null | undefined): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function naarIso(d: Date): IsoDatum {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function plusDagen(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** Hele dagen van a naar b (negatief als b eerder is). */
export function dagenTussen(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAG)
}

export function vandaag(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Datums voluit: 03-10-2026. */
export function fmt(d: Date | null | undefined): string {
  if (!d) return '—'
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

/** Tijdstip in het logboek: "Vandaag · 09:12", "Gisteren · 16:40" of "05-10-2026 · 11:03". */
export function fmtMoment(iso: string, nu: Date = vandaag()): string {
  const d = new Date(iso)
  const dag = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const n = dagenTussen(dag, nu)
  const tijd = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${n === 0 ? 'Vandaag' : n === 1 ? 'Gisteren' : fmt(dag)} · ${tijd}`
}

export const dagen = (n: number) => `${n} ${Math.abs(n) === 1 ? 'dag' : 'dagen'}`

/** Hoe lang geleden, grof: "Vandaag", "Gisteren", "5 dagen", "3 weken" of "4 maanden geleden". */
export function geleden(iso: string, nu: Date = vandaag()): string {
  const d = new Date(iso)
  const n = dagenTussen(new Date(d.getFullYear(), d.getMonth(), d.getDate()), nu)
  if (n <= 0) return 'Vandaag'
  if (n === 1) return 'Gisteren'
  if (n < 14) return `${n} dagen geleden`
  if (n < 61) return `${Math.floor(n / 7)} weken geleden`
  return `${Math.floor(n / 30)} maanden geleden`
}

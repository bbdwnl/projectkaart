import type { Actie, Project } from './types'
import { fmt, naarDatum } from './datum'

// De mails aan actiehouders (zoals in het prototype): een herinnering vóór het overleg en de open acties erna.
// De app verstuurt niets zelf: hij opent een kant-en-klare mail in Outlook of het mailprogramma, of je kopieert hem.

export interface Actiehouder {
  naam: string
  acties: { a: Actie, nr: number, p: Pick<Project, 'naam' | 'slug'> }[]
  teLaat: number
}

/** Per actiehouder zijn open acties (met tekst), over alle projecten; genummerd zoals op de kaart. */
export function actiehouders(acties: Actie[], projecten: Pick<Project, 'id' | 'naam' | 'slug'>[], nu: Date): Actiehouder[] {
  const nummer = new Map<string, number>()
  for (const p of projecten) {
    acties.filter(a => a.project_id === p.id).sort((a, b) => a.aangemaakt_op.localeCompare(b.aangemaakt_op)).forEach((a, i) => nummer.set(a.id, i + 1))
  }
  const per = new Map<string, Actiehouder>()
  for (const a of acties) {
    const p = projecten.find(x => x.id === a.project_id)
    if (a.gereed || !a.actiehouder || !a.tekst.trim() || !p) continue
    const h = per.get(a.actiehouder) ?? { naam: a.actiehouder, acties: [], teLaat: 0 }
    h.acties.push({ a, nr: nummer.get(a.id) ?? 0, p })
    if (a.deadline && naarDatum(a.deadline)! < nu) h.teLaat++
    per.set(a.actiehouder, h)
  }
  for (const h of per.values()) h.acties.sort((x, y) => x.p.naam.localeCompare(y.p.naam, 'nl') || x.nr - y.nr)
  return [...per.values()].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))
}

export interface Mail { aan: string, onderwerp: string, tekst: string }

/** De acties per project, met een link naar de actielijst op de kaart. */
function lijst(h: Actiehouder, site: string, nu: Date): string {
  const projecten = [...new Set(h.acties.map(x => x.p.slug))]
  return projecten.map((slug) => {
    const eigen = h.acties.filter(x => x.p.slug === slug)
    const regels = eigen.map(({ a, nr }) => {
      const d = naarDatum(a.deadline)
      return `  ${nr}. ${a.tekst.trim()}${d ? ` (deadline ${fmt(d)}${d < nu ? ', te laat' : ''})` : ''}`
    })
    return `${eigen[0]!.p.naam}\n${regels.join('\n')}\n  ${site}/projecten/${slug}#acties`
  }).join('\n\n')
}

const telling = (h: Actiehouder) => `${h.acties.length} open ${h.acties.length === 1 ? 'actie' : 'acties'}${h.teLaat ? `, waarvan ${h.teLaat} te laat` : ''}`

export function herinnering(h: Actiehouder, aan: string, afzender: string, site: string, nu: Date): Mail {
  return {
    aan,
    onderwerp: 'Herinnering: werk je acties bij vóór het overleg',
    tekst: `Hoi ${h.naam},\n\nBinnenkort is het overleg. Wil je je acties bijwerken in de projectkaart? Je hebt ${telling(h)}:\n\n${lijst(h, site, nu)}\n\nGroet,\n${afzender}`,
  }
}

export function openActies(h: Actiehouder, aan: string, afzender: string, site: string, nu: Date): Mail {
  return {
    aan,
    onderwerp: `Je open acties uit het overleg (${h.acties.length})`,
    tekst: `Hoi ${h.naam},\n\nDit zijn je ${telling(h)} uit het overleg:\n\n${lijst(h, site, nu)}\n\nGroet,\n${afzender}`,
  }
}

/** Eén herinnering aan iedereen met een e-mailadres. */
export function herinneringAanIedereen(adressen: string[], afzender: string, site: string): Mail {
  return {
    aan: adressen.join(';'),
    onderwerp: 'Herinnering: werk je acties bij vóór het overleg',
    tekst: `Hoi allemaal,\n\nBinnenkort is het overleg. Willen jullie je acties bijwerken in de projectkaart? Ze staan per project onder Acties:\n${site}\n\nGroet,\n${afzender}`,
  }
}

/** Een link die de mail opent: in Outlook op het web, of in het mailprogramma van de computer. */
export function mailLink(m: Mail, via: 'web' | 'app'): string {
  const q = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  return via === 'web'
    ? `https://outlook.office.com/mail/deeplink/compose?${q({ to: m.aan, subject: m.onderwerp, body: m.tekst })}`
    : `mailto:${encodeURIComponent(m.aan).replace(/%40/g, '@').replace(/%3B/g, ';')}?${q({ subject: m.onderwerp, body: m.tekst })}`
}

export const alsTekst = (m: Mail) => `Aan: ${m.aan}\nOnderwerp: ${m.onderwerp}\n\n${m.tekst}`

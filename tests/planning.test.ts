import { describe, expect, it } from 'vitest'
import projecten from '~/data/projecten.json'
import { maakDemoGegevens } from '~/data/demo'
import { leegProject } from '~/lib/leads'
import { bezetting, planRegels, segmentenVan, tijdas } from '~/lib/planning'
import type { Project } from '~/lib/types'

const nu = new Date(2026, 9, 14)
const project = (extra: Partial<Project>): Project => leegProject({ id: 'p1', slug: 'p1', naam: 'Proef', ...extra })

describe('planningsoverzicht', () => {
  it('maakt van de harde datums stukken van datum naar datum, zonder overlap', () => {
    const p = project({ fase: 'uitvoering', datum_casco: '2026-05-01', datum_voorbereiding: '2026-11-09', datum_inkoop: '2027-01-18', datum_afbouw: '2027-03-01', datum_oplevering: '2027-07-30' })
    const s = segmentenVan(p, 'lopend', nu)
    expect(s.map(x => [x.naam, x.stap])).toEqual([
      ['Start casco → start voorbereiding', 0],
      ['Start voorbereiding → inkoop gereed', 0],
      ['Inkoop gereed → start afbouw', 1],
      ['Start afbouw → oplevering', 2],
    ])
    for (let i = 1; i < s.length; i++) expect(s[i]!.van.getTime()).toBe(s[i - 1]!.tot.getTime())
  })

  it('laat de prognose lopen van vandaag (haalbaarheid) via casco en afbouw tot de oplevering', () => {
    const p = project({ fase: 'haalbaarheid', prognose_casco: '2027-03-01', prognose_afbouw: '2027-08-01', prognose_oplevering: '2028-01-15' })
    const s = segmentenVan(p, 'prognose', nu)
    expect(s.map(x => [x.naam, x.stap])).toEqual([
      ['Haalbaarheid → start casco', 0],
      ['Start casco → start afbouw', 1],
      ['Start afbouw → oplevering', 2],
    ])
    expect(s[0]!.van).toEqual(nu)
    // Ligt de prognose al achter ons, dan geen stuk haalbaarheid.
    expect(segmentenVan(project({ fase: 'haalbaarheid', prognose_casco: '2026-01-01', prognose_oplevering: '2027-01-01' }), 'prognose', nu)).toHaveLength(1)
  })

  it('zet haalbaarheid in de laag prognose en ontwikkeling tot nazorg in lopend, met wie in die fase verantwoordelijk is', () => {
    const r = planRegels([
      project({ id: 'a', fase: 'haalbaarheid', am: 'Jeroen de Wit' }),
      project({ id: 'b', fase: 'ontwikkeling', po: 'Michiel' }),
      project({ id: 'c', fase: 'nazorg', pm: 'Carlo' }),
      project({ id: 'd', fase: 'lead', am: 'Peter' }),
    ], nu)
    expect(r.map(x => [x.p.id, x.laag, x.wie])).toEqual([['a', 'prognose', 'Jeroen'], ['b', 'lopend', 'Michiel'], ['c', 'lopend', 'Carlo']])
  })

  it('telt per maand hoeveel projecten er lopen, per laag; een prognose pas vanaf de start van de bouw', () => {
    const r = planRegels([
      project({ id: 'a', fase: 'haalbaarheid', prognose_casco: '2027-01-10', prognose_oplevering: '2027-06-01' }),
      project({ id: 'b', fase: 'uitvoering', datum_afbouw: '2026-12-01', datum_oplevering: '2027-02-15' }),
    ], nu)
    const as = tijdas(r, nu)
    expect(as.van).toEqual(new Date(2026, 8, 1))
    expect(as.maanden.length).toBeGreaterThanOrEqual(18)
    const m = Object.fromEntries(bezetting(r, as.maanden).map(x => [`${x.maand.getFullYear()}-${x.maand.getMonth() + 1}`, [x.lopend, x.prognose]]))
    expect(m['2026-11']).toEqual([0, 0])
    expect(m['2027-1']).toEqual([1, 1])
    expect(m['2027-3']).toEqual([0, 1])
    expect(m['2027-7']).toEqual([0, 0])
  })

  it('heeft in de proefversie prognoses die samenvallen met lopende projecten, ook bij dezelfde persoon', () => {
    const g = maakDemoGegevens(nu, projecten)
    const r = planRegels(g.projecten, nu)
    const as = tijdas(r, nu)
    expect(bezetting(r, as.maanden).filter(x => x.lopend > 0 && x.prognose > 0).length).toBeGreaterThanOrEqual(6)
    for (const wie of ['Michiel', 'Benno']) {
      const eigen = r.filter(x => x.wie === wie)
      expect(eigen.some(x => x.laag === 'prognose'), wie).toBe(true)
      expect(bezetting(eigen, as.maanden).some(x => x.lopend > 0 && x.prognose > 0), wie).toBe(true)
    }
  })
})

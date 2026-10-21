import { describe, expect, it } from 'vitest'
import { leegProject } from '~/lib/leads'
import { signalen } from '~/lib/signalen'
import type { Project } from '~/lib/types'

const nu = new Date(2026, 9, 20)
let n = 0
const project = (extra: Partial<Project>): Project => leegProject({ id: `p${++n}`, slug: `p${n}`, naam: `Project ${n}`, fase: 'ontwikkeling', po: 'Michiel', pm: 'Carlo', ...extra })
const teksten = (ps: Project[]) => signalen(ps, nu).map(s => s.tekst)

describe('aandachtspunten in de planning', () => {
  it('ziet datums in de verkeerde volgorde, en vraagt bij casco na voorbereiding of dat klopt', () => {
    const t = teksten([project({ naam: 'Buren', datum_voorbereiding: '2026-10-12', datum_casco: '2026-11-01', datum_inkoop: '2027-02-01', datum_afbouw: '2027-01-15', datum_oplevering: '2027-06-01' })])
    expect(t).toContain('Buren: inkoop gereed (01-02-2027) ligt ná start afbouw (15-01-2027).')
    expect(t).toContain('Buren start casco (01-11-2026) ná de start van de voorbereiding (12-10-2026). Klopt dat?')
    // Wat niet klopt, staat bovenaan.
    expect(signalen([project({ datum_voorbereiding: '2026-10-12', datum_casco: '2026-11-01', datum_inkoop: '2027-02-01', datum_afbouw: '2027-01-15', datum_oplevering: '2027-06-01' })], nu)[0]!.soort).toBe('klopt-niet')
  })

  it('ziet afbouw zonder opleverdatum, gestart of nog niet', () => {
    const s = signalen([
      project({ naam: 'Al bezig', datum_inkoop: '2026-08-01', datum_afbouw: '2026-09-01' }),
      project({ naam: 'Straks', datum_inkoop: '2026-12-01', datum_afbouw: '2027-01-10' }),
    ], nu)
    expect(s.find(x => x.tekst.startsWith('Afbouw al gestart'))!.projecten.map(p => p.naam)).toEqual(['Al bezig'])
    expect(s.find(x => x.tekst.startsWith('Start afbouw bekend'))!.projecten.map(p => p.naam)).toEqual(['Straks'])
  })

  it('ziet een oplevering die voorbij is terwijl het project nog niet in nazorg staat, en ontbrekende mensen', () => {
    const t = teksten([
      project({ naam: 'Klaar', fase: 'uitvoering', datum_afbouw: '2026-03-01', datum_oplevering: '2026-09-01' }),
      project({ naam: 'Niemand', po: null, datum_inkoop: '2027-01-01' }),
    ])
    expect(t).toContain('Oplevering is voorbij, maar het project staat nog niet in nazorg.')
    expect(t).toContain('Nog geen projectontwikkelaar: 1 project.')
  })

  it('ziet veel starts afbouw op dezelfde dag, vanaf drie', () => {
    const op = (naam: string) => project({ naam, datum_inkoop: '2026-11-01', datum_afbouw: '2026-12-01', datum_oplevering: '2027-05-01' })
    expect(teksten([op('A'), op('B')]).some(t => t.includes('starten'))).toBe(false)
    expect(teksten([op('A'), op('B'), op('C')])).toContain('Op 01-12-2026 starten 3 projecten de afbouw.')
  })

  it('laat lead en haalbaarheid buiten beschouwing', () => {
    expect(signalen([project({ fase: 'haalbaarheid', po: null, datum_inkoop: '2027-02-01', datum_afbouw: '2027-01-15' })], nu)).toEqual([])
  })
})

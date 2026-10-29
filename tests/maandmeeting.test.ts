import { describe, expect, it } from 'vitest'
import projecten from '~/data/projecten.json'
import { maakDemoGegevens } from './voorbeeldgegevens'
import { leegProject } from '~/lib/leads'
import { meeting, pastBij, VOORUIT_DAGEN } from '~/lib/maandmeeting'
import { ORDE } from '~/lib/stoplicht'
import type { Actie, Controlepunt } from '~/lib/types'

describe('maand meeting', () => {
  const nu = new Date(2026, 9, 12)
  const g = maakDemoGegevens(nu, projecten)

  it('zet per fase wat afwijkt bovenaan, het ernstigste eerst, met in woorden waarom', () => {
    const m = meeting(g.projecten, g.taken, g.uitzonderingen, g.acties, g.controlepunten, nu)
    expect(m.fasen.map(f => f.fase)).toEqual(['lead', 'haalbaarheid', 'ontwikkeling', 'uitvoering', 'nazorg'])
    const ontw = m.fasen.find(f => f.fase === 'ontwikkeling')!
    expect(ontw.afwijkend.length).toBeGreaterThan(0)
    for (const r of ontw.afwijkend) expect(r.afwijkingen.length).toBeGreaterThan(0)
    for (let i = 1; i < ontw.afwijkend.length; i++) expect(ORDE[ontw.afwijkend[i - 1]!.licht]).toBeLessThanOrEqual(ORDE[ontw.afwijkend[i]!.licht])
    const laat = ontw.afwijkend.find(r => r.licht === 'telaat')!
    expect(laat.afwijkingen[0]!.tekst).toMatch(/te laat/)
    for (const r of ontw.opSchema) expect(r.afwijkingen).toEqual([])
  })

  it('noemt acties te laat, open aandachtspunten en wat er in de planning opvalt', () => {
    const p = leegProject({ id: 'p1', slug: 'brink', naam: 'De Brink', fase: 'uitvoering', pm: 'Carlo',
      datum_afbouw: '2026-09-01', datum_oplevering: '2026-10-01' })
    const actie = { id: 'a1', project_id: 'p1', tekst: 'Kozijnen', actiehouder: 'Carlo', deadline: '2026-10-01', gereed: false } as Actie
    const punt = { id: 'c1', project_id: 'p1', opgelost: false } as Controlepunt
    const m = meeting([p], [], [], [actie], [punt], nu)
    const r = m.fasen.find(f => f.fase === 'uitvoering')!.afwijkend[0]!
    expect(r.wie).toBe('Carlo')
    expect(r.licht).toBe('telaat')
    expect(r.afwijkingen.map(a => a.tekst)).toEqual(expect.arrayContaining([
      '1 actie uit het overleg te laat',
      '1 aandachtspunt open bij Controle',
      'Oplevering is voorbij, maar het project staat nog niet in nazorg.',
    ]))
  })

  it('laat afgehandelde nazorg en leads in de wachtkamer weg', () => {
    const klaar = leegProject({ id: 'p2', slug: 'klaar', naam: 'Klaar', fase: 'nazorg', afgehandeld: true })
    const wacht = leegProject({ id: 'p3', slug: 'wacht', naam: 'Wacht', fase: 'lead', wachtkamer: true })
    const m = meeting([klaar, wacht], [], [], [], [], nu)
    expect(m.fasen.flatMap(f => [...f.afwijkend, ...f.opSchema])).toEqual([])
  })

  it('geeft de mijlpalen tot de volgende meeting, de vroegste eerst', () => {
    const m = meeting(g.projecten, g.taken, g.uitzonderingen, g.acties, g.controlepunten, nu)
    for (const x of m.mijlpalen) expect(x.dagen).toBeGreaterThanOrEqual(0)
    for (const x of m.mijlpalen) expect(x.dagen).toBeLessThanOrEqual(VOORUIT_DAGEN)
    for (let i = 1; i < m.mijlpalen.length; i++) expect(m.mijlpalen[i - 1]!.datum.getTime()).toBeLessThanOrEqual(m.mijlpalen[i]!.datum.getTime())
  })

  it('filtert op de fase-eigenaar, ook op wie er nog niemand heeft', () => {
    const p = leegProject({ id: 'p4', slug: 'x', naam: 'X', fase: 'ontwikkeling', po: null })
    const r = meeting([p], [], [], [], [], nu).fasen.find(f => f.fase === 'ontwikkeling')!
    const rij = [...r.afwijkend, ...r.opSchema][0]!
    expect(pastBij(rij, 'geen')).toBe(true)
    expect(pastBij(rij, 'Benno')).toBe(false)
    expect(pastBij(rij, 'alle')).toBe(true)
  })
})

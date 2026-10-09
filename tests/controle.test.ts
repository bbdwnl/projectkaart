import { describe, expect, it } from 'vitest'
import { fotoPad, groepeerPunten, nummerPerProject, pastPunt, pdfNaam, sorteerPunten, telPunten } from '~/lib/controle'
import type { Controlepunt } from '~/lib/types'

const punt = (id: string, extra: Partial<Controlepunt> = {}): Controlepunt => ({
  id, project_id: 'p1', leverancier_id: 'lev-1', notitie: id, foto: fotoPad('p1', id), opgelost: false,
  opgelost_door: null, opgelost_op: null, aangemaakt_door: 'Michiel', aangemaakt_op: '2026-10-01T09:00:00Z', ...extra,
})

describe('controle', () => {
  const punten = [
    punt('oud-open', { aangemaakt_op: '2026-09-01T09:00:00Z' }),
    punt('opgelost', { opgelost: true, aangemaakt_op: '2026-10-05T09:00:00Z', leverancier_id: 'lev-2' }),
    punt('nieuw-open', { aangemaakt_op: '2026-10-08T09:00:00Z', leverancier_id: 'lev-2' }),
    punt('zonder', { aangemaakt_op: '2026-09-20T09:00:00Z', leverancier_id: null }),
  ]

  it('zet open punten bovenaan, het nieuwste eerst', () => {
    expect(sorteerPunten(punten).map(p => p.id)).toEqual(['nieuw-open', 'zonder', 'oud-open', 'opgelost'])
  })
  it('filtert op open, opgelost en leverancier, ook op punten zonder leverancier', () => {
    const ids = (f: Parameters<typeof pastPunt>[1], lev = 'alle') => punten.filter(p => pastPunt(p, f, lev)).map(p => p.id)
    expect(ids('open')).toEqual(['oud-open', 'nieuw-open', 'zonder'])
    expect(ids('alles', 'geen')).toEqual(['zonder'])
    expect(ids('opgelost')).toEqual(['opgelost'])
    expect(ids('alles', 'lev-2')).toEqual(['opgelost', 'nieuw-open'])
    expect(ids('open', 'lev-2')).toEqual(['nieuw-open'])
  })
  it('zet de foto in de map van het project', () => {
    expect(fotoPad('p1', 'abc')).toBe('p1/abc.jpg')
  })

  it('groepeert per leverancier, op naam, met "zonder leverancier" achteraan', () => {
    const namen: Record<string, string> = { 'lev-1': 'Klimaattechniek Oost', 'lev-2': 'Bouwbedrijf Van Wijk', geen: 'Zonder leverancier' }
    const groepen = groepeerPunten(punten, 'leverancier', s => namen[s]!)
    expect(groepen.map(g => [g.titel, g.punten.map(p => p.id)])).toEqual([
      ['Bouwbedrijf Van Wijk', ['nieuw-open', 'opgelost']],
      ['Klimaattechniek Oost', ['oud-open']],
      ['Zonder leverancier', ['zonder']],
    ])
  })
  it('groepeert per project en telt open en totaal', () => {
    const ander = punt('elders', { project_id: 'p2', foto: fotoPad('p2', 'elders') })
    expect(groepeerPunten([...punten, ander], 'project', s => (s === 'p1' ? 'Vlijtseweg' : 'Apeldoorn')).map(g => [g.sleutel, g.punten.length])).toEqual([['p2', 1], ['p1', 4]])
    expect(Object.fromEntries(telPunten([...punten, ander], 'project'))).toEqual({ p1: { open: 3, totaal: 4 }, p2: { open: 1, totaal: 1 } })
    expect(telPunten(punten, 'leverancier').get('geen')).toEqual({ open: 1, totaal: 1 })
  })
  it('maakt een nette bestandsnaam voor de pdf', () => {
    expect(pdfNaam(['Apeldoorn Vlijtseweg', 'Glas/Kozijn: "Oost"'], '09-10-2026')).toBe('Controle - Apeldoorn Vlijtseweg - Glas Kozijn Oost - 09-10-2026.pdf')
  })

  it('nummert per project in volgorde van melden', () => {
    const ander = punt('elders', { project_id: 'p2', aangemaakt_op: '2026-08-01T09:00:00Z' })
    expect(Object.fromEntries(nummerPerProject([...punten, ander]))).toEqual({ 'oud-open': 1, 'zonder': 2, 'opgelost': 3, 'nieuw-open': 4, 'elders': 1 })
  })
})

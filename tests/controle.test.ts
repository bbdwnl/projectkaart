import { describe, expect, it } from 'vitest'
import { fotoPad, pastPunt, sorteerPunten } from '~/lib/controle'
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
  ]

  it('zet open punten bovenaan, het nieuwste eerst', () => {
    expect(sorteerPunten(punten).map(p => p.id)).toEqual(['nieuw-open', 'oud-open', 'opgelost'])
  })
  it('filtert op open, opgelost en leverancier', () => {
    const ids = (f: Parameters<typeof pastPunt>[1], lev = 'alle') => punten.filter(p => pastPunt(p, f, lev)).map(p => p.id)
    expect(ids('open')).toEqual(['oud-open', 'nieuw-open'])
    expect(ids('opgelost')).toEqual(['opgelost'])
    expect(ids('alles', 'lev-2')).toEqual(['opgelost', 'nieuw-open'])
    expect(ids('open', 'lev-2')).toEqual(['nieuw-open'])
  })
  it('zet de foto in de map van het project', () => {
    expect(fotoPad('p1', 'abc')).toBe('p1/abc.jpg')
  })
})

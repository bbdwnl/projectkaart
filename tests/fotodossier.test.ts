import { describe, expect, it } from 'vitest'
import { perDag } from '~/lib/fotodossier'
import type { Dossierfoto } from '~/lib/types'

const foto = (id: string, aangemaakt_op: string, titel: string | null = null): Dossierfoto =>
  ({ id, project_id: 'p1', titel, foto: `p1/${id}.jpg`, aangemaakt_door: 'Michiel', aangemaakt_op })

describe('fotodossier', () => {
  it('zet de foto\'s per dag, de nieuwste dag en de nieuwste foto eerst', () => {
    const nu = new Date(2026, 10, 27)
    const dagen = perDag([
      foto('a', new Date(2026, 10, 20, 9, 0).toISOString()),
      foto('b', new Date(2026, 10, 27, 8, 0).toISOString()),
      foto('c', new Date(2026, 10, 26, 16, 30).toISOString()),
      foto('d', new Date(2026, 10, 27, 14, 5).toISOString()),
    ], nu)
    expect(dagen.map(d => d.dag)).toEqual(['Vandaag', 'Gisteren', '20-11-2026'])
    expect(dagen[0]!.fotos.map(f => f.id)).toEqual(['d', 'b'])
  })

  it('geeft niets terug zonder foto\'s', () => {
    expect(perDag([], new Date())).toEqual([])
  })
})

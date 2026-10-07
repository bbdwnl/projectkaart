import { describe, expect, it } from 'vitest'
import { aantalPerUitzondering, analyseUitzonderingen, isKandidaat, vaakNvt } from '~/lib/uitzonderingen'
import type { Fase, Project, Taak, Uitzondering } from '~/lib/types'

const project = (id: string, fase: Fase) => ({ id, fase } as Project)
const taak = (project_id: string, extra: Partial<Taak>) => ({ project_id, status: 'niet_gestart', ...extra } as Taak)
const u = (id: string, titel: string, fase: Fase = 'ontwikkeling'): Uitzondering => ({ id, titel, fase, status: 'uitzondering', aangemaakt_op: null })

describe('isKandidaat', () => {
  it('vanaf 4 projecten altijd', () => expect(isKandidaat(4, 40)).toBe(true))
  it('of minstens 20% van de projecten die de fase bereikten, maar niet bij één keer', () => {
    expect(isKandidaat(2, 10)).toBe(true)
    expect(isKandidaat(2, 11)).toBe(false)
    expect(isKandidaat(1, 2)).toBe(false)
  })
})

describe('analyseUitzonderingen', () => {
  const projecten = [project('a', 'ontwikkeling'), project('b', 'uitvoering'), project('c', 'haalbaarheid'), project('d', 'ontwikkeling')]
  const catalogus = [u('pfas', 'Extra bodemonderzoek (PFAS)'), u('asbest', 'Asbestinventarisatie', 'haalbaarheid')]
  const taken = [
    taak('a', { uitzondering_id: 'pfas' }), taak('b', { uitzondering_id: 'pfas' }),
    taak('b', { uitzondering_id: 'pfas' }), // dubbel in één project telt één keer
    taak('c', { uitzondering_id: 'asbest' }),
  ]
  it('telt projecten, niet taken, en deelt door de projecten die de fase bereikten', () => {
    const [pfas, asbest] = analyseUitzonderingen(catalogus, taken, projecten)
    expect(pfas).toMatchObject({ aantal: 2, bereikt: 3, kandidaat: true })
    expect(asbest).toMatchObject({ aantal: 1, bereikt: 4, kandidaat: false })
  })
  it('telt per uitzondering voor de suggesties', () => {
    expect(aantalPerUitzondering(taken).get('pfas')).toBe(2)
  })
})

describe('vaakNvt', () => {
  it('vindt standaardtaken die vaak niet van toepassing zijn, met de redenen', () => {
    const projecten = [project('a', 'ontwikkeling'), project('b', 'ontwikkeling'), project('c', 'uitvoering')]
    const taken = [
      taak('a', { lijst: 'ontwikkeling', sleutel: 'sloopplan', status: 'nvt', reden_nvt: 'Nieuwbouw' }),
      taak('b', { lijst: 'ontwikkeling', sleutel: 'sloopplan', status: 'nvt', reden_nvt: 'Nieuwbouw' }),
      taak('c', { lijst: 'ontwikkeling', sleutel: 'zonnepanelen', status: 'nvt', reden_nvt: 'Geen dak' }),
    ]
    const uit = vaakNvt(taken, projecten)
    expect(uit).toHaveLength(1)
    expect(uit[0]).toMatchObject({ titel: 'Sloopplan', aantal: 2, bereikt: 3, redenen: ['Nieuwbouw'] })
  })
})

import { describe, expect, it } from 'vitest'
import projecten from '~/data/projecten.json'
import { EISEN, FASEN } from '~/lib/fasen'
import { LIJSTEN, vindStandaardtaak } from '~/lib/taken'
import type { Fase } from '~/lib/types'

describe('standaardpakket', () => {
  it('heeft per lijst unieke sleutels', () => {
    for (const fase of Object.keys(LIJSTEN) as Fase[]) {
      const sleutels = LIJSTEN[fase].flatMap(g => g.taken.map(t => t.sleutel))
      expect(new Set(sleutels).size, fase).toBe(sleutels.length)
    }
  })
  it('koppelt elke overdrachtseis aan een bestaande standaardtaak', () => {
    for (const fase of Object.keys(EISEN) as Fase[]) {
      for (const eis of EISEN[fase].items) {
        for (const k of eis.taken) {
          const [lijst, sleutel] = k.split(':') as [Fase, string]
          expect(vindStandaardtaak(lijst, sleutel), `${fase}: ${eis.titel} -> ${k}`).toBeDefined()
        }
      }
    }
  })
})

describe('startgegevens uit het prototype', () => {
  const fasen = FASEN.map(f => f.id)
  it('heeft 27 lopende projecten met unieke slugs en projectnummers', () => {
    expect(projecten).toHaveLength(27)
    expect(new Set(projecten.map(p => p.slug)).size).toBe(27)
    const nummers = projecten.map(p => p.nummer).filter(Boolean)
    expect(new Set(nummers).size).toBe(nummers.length)
  })
  it('heeft geldige fasen en datums', () => {
    for (const p of projecten) {
      expect(fasen, p.slug).toContain(p.fase)
      for (const k of ['datum_casco', 'datum_voorbereiding', 'datum_inkoop', 'datum_afbouw', 'datum_oplevering'] as const) {
        const v = p[k]
        if (v) expect(v, `${p.slug} ${k}`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })
})

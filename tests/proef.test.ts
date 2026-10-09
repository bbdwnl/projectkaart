import { describe, expect, it } from 'vitest'
import projecten from '~/data/projecten.json'
import { maakDemoGegevens } from '~/data/demo'
import { takenVan, telling, standZin } from '~/lib/stoplicht'
import { gelijk, proefToken } from '../server/utils/proef'

describe('voorbeeldgegevens van de proefversie', () => {
  const nu = new Date(2026, 9, 7)
  const g = maakDemoGegevens(nu, projecten)
  const p = g.projecten.find(x => x.nummer === 'P20038')!

  it('maakt alle 27 projecten, plus de verzonnen leads, met unieke slugs', () => {
    expect(g.projecten.filter(x => x.fase !== 'lead')).toHaveLength(27)
    expect(g.projecten.filter(x => x.fase === 'lead')).toHaveLength(8)
    expect(new Set(g.projecten.map(x => x.slug)).size).toBe(g.projecten.length)
  })
  it('maakt aandachtspunten met een leverancier van hun eigen project (of nog geen), en één gedeelde foto', () => {
    expect(g.controlepunten.length).toBeGreaterThan(10)
    for (const c of g.controlepunten) {
      if (c.leverancier_id) expect(g.projectLeveranciers.some(k => k.project_id === c.project_id && k.leverancier_id === c.leverancier_id), c.id).toBe(true)
      expect(g.fotos[c.foto], c.id).toBe('/voorbeeld-aandachtspunt.jpg')
    }
    expect(g.controlepunten.some(c => c.opgelost) && g.controlepunten.some(c => !c.leverancier_id)).toBe(true)
  })
  it('zet de aandachtspunten van Vlijtseweg op de voorbeeldtekening, de rest zonder plek', () => {
    expect(g.tekeningen.map(t => t.project_id)).toEqual([p.id])
    const op = g.controlepunten.filter(c => c.tekening_id)
    expect(op.length).toBeGreaterThan(3)
    for (const c of op) {
      expect(c.project_id).toBe(p.id)
      expect([1, 2]).toContain(c.tekening_blad)
      expect(c.tekening_x! > 0 && c.tekening_x! < 1 && c.tekening_y! > 0 && c.tekening_y! < 1, c.id).toBe(true)
    }
    expect(g.controlepunten.filter(c => c.project_id !== p.id).every(c => c.tekening_id === null)).toBe(true)
  })
  it('laat Apeldoorn Vlijtseweg zien zoals in design-referentie.html', () => {
    const regels = takenVan('ontwikkeling', p, g.taken.filter(t => t.project_id === p.id), g.uitzonderingen, nu)
    const t = telling(regels)
    expect([t.telaat, t.letop, t.klaar]).toEqual([4, 7, 18])
    expect(standZin(p, regels).map(z => z.tekst).join('')).toBe('4 taken te laat en 7 vragen aandacht voor inkoop gereed op 20-10-2026.')
  })
  it('is elke keer hetzelfde', () => {
    expect(maakDemoGegevens(nu, projecten).taken.map(t => t.status)).toEqual(g.taken.map(t => t.status))
  })
})

describe('wachtwoord van de proefversie', () => {
  it('vergelijkt exact', () => {
    expect(gelijk('geheim', 'geheim')).toBe(true)
    expect(gelijk('geheim', 'Geheim')).toBe(false)
    expect(gelijk('', 'geheim')).toBe(false)
  })
  it('maakt een cookie dat verandert met het wachtwoord', () => {
    expect(proefToken('a')).toBe(proefToken('a'))
    expect(proefToken('a')).not.toBe(proefToken('b'))
    expect(proefToken('mijnwachtwoord')).toMatch(/^[0-9a-f]{64}$/)
    expect(proefToken('mijnwachtwoord')).not.toContain('mijnwachtwoord')
  })
})

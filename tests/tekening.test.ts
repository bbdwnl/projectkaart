import { describe, expect, it } from 'vitest'
import { begrens, centreer, naarBlad, naarScherm, opBlad, passend, zichtbaarDeel, zoomRond, Z_MAX, type Maat } from '~/lib/tekening'

// Een A3 liggend (1190 × 842 punten) in een telefoonscherm van 390 × 700.
const pas = passend(390, 700, 1190, 842)
const m: Maat = { vlakB: 390, vlakH: 700, basisB: pas.basisB, basisH: pas.basisH }

describe('tekeningviewer', () => {
  it('zet het blad passend en gecentreerd in het vlak', () => {
    expect(pas.basisB).toBeCloseTo(358)
    expect(pas.beeld.tx).toBeCloseTo(16)
    expect(pas.beeld.ty).toBeCloseTo((700 - pas.basisH) / 2)
  })
  it('rekent heen en terug tussen blad en scherm', () => {
    const b = { tx: -120, ty: 40, z: 3.5 }
    const { sx, sy } = naarScherm(b, m, 0.42, 0.61)
    const terug = naarBlad(b, m, sx, sy)
    expect(terug.x).toBeCloseTo(0.42)
    expect(terug.y).toBeCloseTo(0.61)
    expect(opBlad(terug.x, terug.y)).toBe(true)
    expect(opBlad(-0.01, 0.5)).toBe(false)
  })
  it('houdt bij zoomen het punt onder de vingers op zijn plek, binnen de grenzen', () => {
    const b = pas.beeld
    const voor = naarBlad(b, m, 200, 300)
    const na = zoomRond(b, 2.5, 200, 300)
    const plek = naarBlad(na, m, 200, 300)
    expect(na.z).toBeCloseTo(2.5)
    expect(plek.x).toBeCloseTo(voor.x)
    expect(plek.y).toBeCloseTo(voor.y)
    expect(zoomRond(b, 1000, 0, 0).z).toBe(Z_MAX)
  })
  it('centreert een plek en laat het blad niet uit beeld schuiven', () => {
    const b = centreer(m, 0.5, 0.5, 4)
    const midden = naarScherm(b, m, 0.5, 0.5)
    expect(midden.sx).toBeCloseTo(195)
    expect(midden.sy).toBeCloseTo(350)
    const weg = begrens({ tx: 5000, ty: -5000, z: 4 }, m)
    expect(weg.tx).toBe(48)
    expect(weg.ty).toBeCloseTo(700 - 4 * m.basisH - 48)
  })
  it('weet welk deel van het blad in beeld is', () => {
    expect(zichtbaarDeel(pas.beeld, m)).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 })
    const deel = zichtbaarDeel(centreer(m, 0.5, 0.5, 4), m)!
    expect(deel.x0).toBeCloseTo(0.5 - 390 / 2 / (4 * m.basisB))
    expect(deel.x1 - deel.x0).toBeCloseTo(390 / (4 * m.basisB))
    expect(zichtbaarDeel({ tx: 2000, ty: 0, z: 1 }, m)).toBeNull()
  })
})

describe('pins', () => {
  it('maakt pins van de punten met een plek, genummerd en met tekst', async () => {
    const { pinsVan } = await import('~/lib/tekening')
    const punt = (id: string, plek: boolean) => ({ id, opgelost: id === 'b', notitie: `Notitie ${id}`, tekening_id: plek ? 't1' : null, tekening_blad: plek ? 2 : null, tekening_x: plek ? 0.25 : null, tekening_y: plek ? 0.75 : null })
    const pins = pinsVan([punt('a', true), punt('b', true), punt('c', false)], p => ({ a: 1, b: 2, c: 3 })[p.id]!, p => `Leverancier ${p.id}`)
    expect(pins).toEqual([
      { id: 'a', tekening_id: 't1', blad: 2, x: 0.25, y: 0.75, label: '1', opgelost: false, tekst: 'Notitie a · Leverancier a' },
      { id: 'b', tekening_id: 't1', blad: 2, x: 0.25, y: 0.75, label: '2', opgelost: true, tekst: 'Notitie b · Leverancier b' },
    ])
  })
})

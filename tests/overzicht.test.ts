import { describe, expect, it } from 'vitest'
import projecten from '~/data/projecten.json'
import { maakDemoGegevens } from '~/data/demo'
import { balkTekst, kaartjesVan, KOLOMMEN, leesSortering, sorteerKaartjes, vindt, voornaam } from '~/lib/overzicht'
import { ORDE } from '~/lib/stoplicht'

describe('projectenoverzicht', () => {
  const nu = new Date(2026, 9, 12)
  const g = maakDemoGegevens(nu, projecten)
  const kaartjes = kaartjesVan(g.projecten.filter(p => KOLOMMEN.includes(p.fase)), g.taken, g.uitzonderingen, nu)

  it('heeft drie kolommen, zonder leads en haalbaarheid', () => {
    expect(KOLOMMEN).toEqual(['ontwikkeling', 'uitvoering', 'nazorg'])
    expect(kaartjes.every(k => KOLOMMEN.includes(k.p.fase))).toBe(true)
  })
  it('toont wie in de fase verantwoordelijk is, alleen de voornaam', () => {
    expect(voornaam('Michiel de Vries')).toBe('Michiel')
    expect(voornaam('  Benno ')).toBe('Benno')
    expect(voornaam(null)).toBeNull()
    expect(voornaam('')).toBeNull()
    const k = kaartjes.find(x => x.p.fase === 'ontwikkeling')!
    expect(k.rol).toBe('po')
    expect(k.wie).toBe(voornaam(k.p.po))
    expect(kaartjes.find(x => x.p.fase === 'uitvoering')!.rol).toBe('pm')
  })
  it('zet standaard het dringendste bovenaan', () => {
    for (let i = 1; i < kaartjes.length; i++) expect(ORDE[kaartjes[i - 1]!.licht]).toBeLessThanOrEqual(ORDE[kaartjes[i]!.licht])
  })
  it('sorteert ook alfabetisch en op inkoop gereed (zonder datum achteraan)', () => {
    const namen = sorteerKaartjes(kaartjes, 'naam').map(k => k.p.naam)
    expect(namen).toEqual([...namen].sort((a, b) => a.localeCompare(b, 'nl')))
    const inkoop = sorteerKaartjes(kaartjes, 'inkoop').map(k => k.p.datum_inkoop)
    const metDatum = inkoop.filter(Boolean) as string[]
    expect(metDatum).toEqual([...metDatum].sort())
    expect(inkoop.slice(metDatum.length).every(d => d === null)).toBe(true)
    expect(leesSortering('inkoop')).toBe('inkoop')
    expect(leesSortering('iets')).toBe('telaat')
  })
  it('zoekt op naam, nummer en persoon', () => {
    const k = kaartjes.find(x => x.p.nummer && x.wie)!
    expect(vindt(k, k.p.nummer!.toLowerCase())).toBe(true)
    expect(vindt(k, k.wie!)).toBe(true)
    expect(vindt(k, 'zzz-bestaat-niet')).toBe(false)
  })
  it('zegt de kleurenbalk ook in woorden', () => {
    expect(balkTekst({ telaat: 2, letop: 0, open: 3, klaar: 5, later: 0 })).toBe('Taken: 2 te laat, 5 klaar, 3 open')
    expect(balkTekst({ telaat: 0, letop: 0, open: 0, klaar: 0, later: 4 })).toBe('Nog geen taken in deze fase')
  })
})

import { describe, expect, it } from 'vitest'
import projecten from '~/data/projecten.json'
import { maakDemoGegevens } from './voorbeeldgegevens'
import { balkTekst, isAfgehandeld, kaartjesVan, KOLOMMEN, leesSortering, pastWie, personen, sorteerKaartjes, vindt, voornaam } from '~/lib/overzicht'
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
    const afbouw = sorteerKaartjes(kaartjes, 'afbouw').map(k => k.p.datum_afbouw)
    const metAfbouw = afbouw.filter(Boolean) as string[]
    expect(metAfbouw.length).toBeGreaterThan(0)
    expect(metAfbouw).toEqual([...metAfbouw].sort())
    expect(afbouw.slice(metAfbouw.length).every(d => d === null)).toBe(true)
    expect(leesSortering('afbouw')).toBe('afbouw')
    expect(leesSortering('inkoop')).toBe('inkoop')
    expect(leesSortering('iets')).toBe('telaat')
  })
  it('telt afgehandeld alleen in nazorg', () => {
    expect(isAfgehandeld({ fase: 'nazorg', afgehandeld: true })).toBe(true)
    expect(isAfgehandeld({ fase: 'nazorg', afgehandeld: false })).toBe(false)
    expect(isAfgehandeld({ fase: 'uitvoering', afgehandeld: true })).toBe(false)
  })
  it('zoekt op naam, nummer en persoon', () => {
    const k = kaartjes.find(x => x.p.nummer && x.wie)!
    expect(vindt(k, k.p.nummer!.toLowerCase())).toBe(true)
    expect(vindt(k, k.wie!)).toBe(true)
    expect(vindt(k, 'zzz-bestaat-niet')).toBe(false)
  })
  it('filtert op wie verantwoordelijk is, ook op projecten zonder', () => {
    const zonder = { ...kaartjes[0]!, wie: null }
    const lijst = [...kaartjes, zonder]
    const mensen = personen(lijst, 'alle')
    expect(mensen.at(-1)).toEqual({ id: 'geen', aantal: lijst.filter(k => !k.wie).length })
    expect(mensen.reduce((n, m) => n + m.aantal, 0)).toBe(lijst.length)
    const naam = mensen[0]!.id
    expect(lijst.filter(k => pastWie(k, naam)).every(k => k.wie === naam)).toBe(true)
    expect(lijst.filter(k => pastWie(k, 'geen'))).toEqual(lijst.filter(k => !k.wie))
    expect(lijst.filter(k => pastWie(k, 'alle'))).toHaveLength(lijst.length)
    // Een gekozen naam zonder projecten blijft als knop staan, met 0.
    expect(personen(lijst, 'Iemand')).toContainEqual({ id: 'Iemand', aantal: 0 })
  })
  it('zegt de kleurenbalk ook in woorden', () => {
    expect(balkTekst({ telaat: 2, letop: 0, open: 3, klaar: 5, later: 0 })).toBe('Taken: 2 te laat, 5 klaar, 3 open')
    expect(balkTekst({ telaat: 0, letop: 0, open: 0, klaar: 0, later: 4 })).toBe('Nog geen taken in deze fase')
  })
})

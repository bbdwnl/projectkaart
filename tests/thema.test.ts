import { describe, expect, it } from 'vitest'
import projecten from '~/data/projecten.json'
import { maakDemoGegevens } from './voorbeeldgegevens'
import { dagenKort, kaartjeInfo, kaartjesVan, KOLOMMEN, voornaam } from '~/lib/overzicht'
import { leesThema, THEMAS } from '~/lib/thema'

describe('thema (beslissing 45)', () => {
  it('kent Kaarten (de standaard) en Zakelijk; een onbekende cookie wordt de standaard', () => {
    expect(THEMAS.map(t => t.id)).toEqual(['kaarten', 'zakelijk'])
    expect(leesThema('zakelijk')).toBe('zakelijk')
    expect(leesThema('kaarten')).toBe('kaarten')
    expect(leesThema('donker')).toBe('kaarten')
    expect(leesThema(null)).toBe('kaarten')
    expect(leesThema(undefined)).toBe('kaarten')
  })
})

describe('kaartje in de weergave Zakelijk', () => {
  const nu = new Date(2026, 9, 12)
  const g = maakDemoGegevens(nu, projecten)
  const kaartjes = kaartjesVan(g.projecten.filter(p => KOLOMMEN.includes(p.fase)), g.taken, g.uitzonderingen, nu)

  it('noemt eerst de verantwoordelijke van de fase, dan PM en opzichter, zonder dubbelen en zonder lege', () => {
    for (const k of kaartjes) {
      const info = kaartjeInfo(k, nu)
      const verwacht = [k.rol, ...(['pm', 'opzichter'] as const).filter(r => r !== k.rol)].map(r => voornaam(k.p[r])).filter(Boolean)
      expect(info.mensen.map(m => m.naam)).toEqual(verwacht)
      if (k.wie) expect(info.mensen[0]!.naam).toBe(k.wie)
    }
  })
  it('telt de taken zonder n.v.t. en geeft de volgende mijlpaal van de fase', () => {
    const k = kaartjes.find(x => x.p.fase === 'ontwikkeling' && x.p.datum_inkoop)!
    const info = kaartjeInfo(k, nu)
    expect(info.totaal).toBe(k.t.telaat + k.t.letop + k.t.open + k.t.klaar)
    expect(info.mijlpaal?.naam).toBe('inkoop gereed')
  })
  it('zet de subfase alleen bij haalbaarheid achter de plaats', () => {
    const k = kaartjes.find(x => x.p.fase === 'uitvoering')!
    const info = kaartjeInfo({ ...k, p: { ...k.p, plaats: 'Leersum', subfase: 'so' } }, nu)
    expect(info.waar).toBe('Leersum')
    const h = kaartjeInfo({ ...k, p: { ...k.p, fase: 'haalbaarheid', plaats: 'Leersum', subfase: 'so' } }, nu)
    expect(h.waar).toBe('Leersum · SO')
    expect(kaartjeInfo({ ...k, p: { ...k.p, plaats: null } }, nu).waar).toBe('')
  })
  it('zegt kort hoe ver een datum weg is', () => {
    expect(dagenKort(0)).toBe('vandaag')
    expect(dagenKort(12)).toBe('over 12 d')
    expect(dagenKort(-3)).toBe('3 d geleden')
  })
})

import { describe, expect, it } from 'vitest'
import { actieveLink, antwoordOpCode, CODE_VORM, deelTekst, externeInhoud, MAX_POGINGEN, nieuweCode, nieuwToken, standVan, TOKEN_VORM } from '~/lib/deellink'
import { fotoPad } from '~/lib/controle'
import { plusMaand } from '~/lib/datum'
import type { Controlepunt, Deellink } from '~/lib/types'

const punt = (id: string, extra: Partial<Controlepunt> = {}): Controlepunt => ({
  id, project_id: 'p1', leverancier_id: 'lev-1', notitie: id, foto: fotoPad('p1', id), opgelost: false,
  opgelost_door: null, opgelost_op: null, aangemaakt_door: 'Michiel', aangemaakt_op: '2026-10-01T09:00:00Z',
  tekening_id: null, tekening_blad: null, tekening_x: null, tekening_y: null, ...extra,
})
const link = (extra: Partial<Deellink> = {}): Deellink => ({
  id: 'dl-1', leverancier_id: 'lev-1', token: 'a'.repeat(64), code: '23456', geldig_tot: '2026-11-12T10:00:00Z',
  gesloten_op: null, gesloten_door: null, gesloten_reden: null, foute_pogingen: 0, bekeken_op: null,
  aangemaakt_door: 'Michiel', aangemaakt_op: '2026-10-12T10:00:00Z', ...extra,
})
const NU = new Date('2026-10-20T12:00:00Z')

describe('deellink: stand', () => {
  it('is open tot de einddatum, daarna verlopen; een reden om dicht te zijn gaat voor', () => {
    expect(standVan(link(), NU)).toBe('open')
    expect(standVan(link(), new Date('2026-11-12T10:00:00Z'))).toBe('verlopen')
    expect(standVan(link({ gesloten_reden: 'opgelost' }), NU)).toBe('opgelost')
    expect(standVan(link({ gesloten_reden: 'ingetrokken' }), new Date('2027-01-01'))).toBe('ingetrokken')
  })
  it('kiest de nieuwste open link van de leverancier', () => {
    const links = [
      link({ id: 'oud', aangemaakt_op: '2026-10-01T10:00:00Z' }),
      link({ id: 'nieuw', aangemaakt_op: '2026-10-10T10:00:00Z' }),
      link({ id: 'dicht', aangemaakt_op: '2026-10-15T10:00:00Z', gesloten_reden: 'ingetrokken' }),
      link({ id: 'ander', leverancier_id: 'lev-2', aangemaakt_op: '2026-10-16T10:00:00Z' }),
    ]
    expect(actieveLink(links, 'lev-1', NU)?.id).toBe('nieuw')
    expect(actieveLink(links, 'lev-3', NU)).toBeNull()
  })
  it('is een maand geldig, ook aan het eind van een maand', () => {
    expect(plusMaand(new Date(2026, 9, 12, 14, 30))).toEqual(new Date(2026, 10, 12, 14, 30))
    expect(plusMaand(new Date(2027, 0, 31))).toEqual(new Date(2027, 1, 28))
    expect(plusMaand(new Date(2026, 11, 15))).toEqual(new Date(2027, 0, 15))
  })
})

describe('deellink: token en code', () => {
  it('maakt een token van 64 tekens en een code van vijf cijfers zonder 0 en 1', () => {
    expect(nieuwToken(new Uint8Array(32).fill(171))).toBe('ab'.repeat(32))
    expect(nieuweCode(new Uint8Array([0, 1, 7, 8, 255]))).toBe('23929')
    for (let i = 0; i < 50; i++) {
      expect(nieuwToken(crypto.getRandomValues(new Uint8Array(32)))).toMatch(TOKEN_VORM)
      expect(nieuweCode(crypto.getRandomValues(new Uint8Array(5)))).toMatch(CODE_VORM)
    }
    expect(CODE_VORM.test('23450')).toBe(false)
    expect(CODE_VORM.test('2345')).toBe(false)
  })
  it('zegt wat de pagina toont bij de code; de database telt en sluit na tien keer', () => {
    expect(antwoordOpCode(link({ foute_pogingen: 3 }), null, NU)).toEqual({ stand: 'code', fout: false, over: MAX_POGINGEN - 3 })
    expect(antwoordOpCode(link({ foute_pogingen: 4 }), false, NU)).toEqual({ stand: 'code', fout: true, over: 6 })
    expect(antwoordOpCode(link({ foute_pogingen: 0 }), true, NU)).toBeNull()
    // De tiende verkeerde: de database sloot de link.
    expect(antwoordOpCode(link({ foute_pogingen: 10, gesloten_reden: 'geblokkeerd', gesloten_op: NU.toISOString() }), false, NU)).toEqual({ stand: 'geblokkeerd', op: NU.toISOString() })
    // Ging hij intussen dicht of verliep hij, dan zegt de pagina dat, ook bij de goede code.
    expect(antwoordOpCode(link({ gesloten_reden: 'opgelost', gesloten_op: NU.toISOString() }), false, NU)?.stand).toBe('opgelost')
    expect(antwoordOpCode(link(), true, new Date('2026-12-01'))?.stand).toBe('verlopen')
  })
  it('zet de link in het bericht, maar de code niet', () => {
    const { onderwerp, tekst } = deelTekst({ leverancier: 'Klimaattechniek Oost', adres: 'https://x/punten/abc', geldigTot: '2026-11-12T10:00:00Z', door: 'Michiel' })
    expect(onderwerp).toBe('Open aandachtspunten BbDW')
    expect(tekst).toContain('Beste Klimaattechniek Oost,')
    expect(tekst).toContain('https://x/punten/abc')
    expect(tekst).toContain('geldig tot 12-11-2026')
    expect(tekst).not.toContain('23456')
    expect(tekst.endsWith('Michiel')).toBe(true)
  })
})

describe('deellink: wat de leverancier ziet', () => {
  const punten = [
    punt('eerste', { aangemaakt_op: '2026-09-01T09:00:00Z', leverancier_id: 'lev-2' }),
    punt('open', { aangemaakt_op: '2026-09-05T09:00:00Z', tekening_id: 't1', tekening_blad: 1, tekening_x: 0.4, tekening_y: 0.6 }),
    punt('opgelost', { aangemaakt_op: '2026-09-10T09:00:00Z', opgelost: true, tekening_id: 't2', tekening_blad: 1, tekening_x: 0.1, tekening_y: 0.1 }),
    punt('ander-van-een-ander', { aangemaakt_op: '2026-09-12T09:00:00Z', leverancier_id: 'lev-2', tekening_id: 't3', tekening_blad: 1, tekening_x: 0.5, tekening_y: 0.5 }),
    punt('elders', { project_id: 'p2', foto: fotoPad('p2', 'elders'), aangemaakt_op: '2026-09-02T09:00:00Z' }),
    punt('niet-van-hem', { project_id: 'p3', foto: fotoPad('p3', 'x'), leverancier_id: 'lev-2' }),
  ]
  const inhoud = externeInhoud({
    link: link(),
    leverancier: { naam: 'Klimaattechniek Oost', vak: 'Installateur' },
    punten,
    projecten: [
      { id: 'p1', naam: 'Apeldoorn Vlijtseweg', postcode: null, huisnummer: null, straat: 'Vlijtseweg', plaats: 'Apeldoorn' },
      { id: 'p2', naam: 'Almere Zorgplein', postcode: '1315 RA', huisnummer: '4', straat: 'Stadhuisplein', plaats: 'Almere' },
      { id: 'p3', naam: 'Oss Molenwijk', postcode: null, huisnummer: null, straat: null, plaats: 'Oss' },
    ],
    tekeningen: [{ id: 't1', project_id: 'p1', naam: 'Begane grond' }, { id: 't2', project_id: 'p1', naam: 'Dak' }, { id: 't3', project_id: 'p1', naam: 'Gevels' }],
    fotoUrl: pad => `https://opslag/${pad}`,
  })

  it('toont alleen zijn open punten, met het nummer zoals bij BbDW', () => {
    expect(inhoud.punten.map(p => [p.id, p.nummer])).toEqual([['elders', 1], ['open', 2]])
    expect(inhoud.punten.find(p => p.id === 'open')).toMatchObject({ foto: 'https://opslag/p1/open.jpg', tekening_id: 't1', tekening_x: 0.4 })
  })
  it('toont alleen de projecten waarop hij open punten heeft, en alleen tekeningen met zijn punten', () => {
    expect(inhoud.projecten.map(p => [p.naam, p.adres])).toEqual([['Almere Zorgplein', 'Stadhuisplein 4, 1315 RA Almere'], ['Apeldoorn Vlijtseweg', 'Vlijtseweg, Apeldoorn']])
    expect(inhoud.tekeningen.map(t => t.id)).toEqual(['t1'])
  })
  it('geeft geen interne velden mee', () => {
    const tekst = JSON.stringify(inhoud)
    for (const veld of ['aangemaakt_door', 'opgelost_door', 'leverancier_id', 'foto":"p1', 'pad', 'code', 'token']) expect(tekst).not.toContain(veld)
    expect(inhoud).toMatchObject({ leverancier: { naam: 'Klimaattechniek Oost', vak: 'Installateur' }, gedeeld_door: 'Michiel', geldig_tot: '2026-11-12T10:00:00Z' })
  })
})

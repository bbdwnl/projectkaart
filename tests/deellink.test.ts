import { describe, expect, it } from 'vitest'
import projecten from '~/data/projecten.json'
import { maakDemoGegevens } from '~/data/demo'
import { maakDemoBron } from '~/data/bron-demo'
import { actieveLink, CODE_VORM, controleerCode, deelTekst, dichtAntwoord, externeInhoud, MAX_POGINGEN, metProefStand, nieuweCode, nieuwToken, schoneInhoud, schoneProefLink, standVan, TOKEN_VORM, type ExternAntwoord, type ExternInhoud, type ProefLink, type ProefStand } from '~/lib/deellink'
import type { ProefServer } from '~/data/proef-server'
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
  it('telt alleen een verkeerde code, en sluit na tien keer', () => {
    expect(controleerCode(link(), '', false, NU)).toEqual({ wijziging: null, antwoord: { stand: 'code', fout: false, over: MAX_POGINGEN } })
    expect(controleerCode(link({ foute_pogingen: 3 }), '22222', false, NU)).toEqual({ wijziging: { foute_pogingen: 4 }, antwoord: { stand: 'code', fout: true, over: 6 } })
    const tiende = controleerCode(link({ foute_pogingen: 9 }), '22222', false, NU)
    expect(tiende.wijziging).toMatchObject({ foute_pogingen: 10, gesloten_reden: 'geblokkeerd' })
    expect(tiende.antwoord?.stand).toBe('geblokkeerd')
    expect(controleerCode(link({ foute_pogingen: 4 }), '23456', true, NU)).toEqual({ wijziging: { foute_pogingen: 0, bekeken_op: NU.toISOString() }, antwoord: null })
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
      { id: 'p1', naam: 'Apeldoorn Vlijtseweg', plaats: 'Apeldoorn', adres: 'Vlijtseweg' },
      { id: 'p2', naam: 'Almere Zorgplein', plaats: 'Almere', adres: null },
      { id: 'p3', naam: 'Oss Molenwijk', plaats: 'Oss', adres: null },
    ],
    tekeningen: [{ id: 't1', project_id: 'p1', naam: 'Begane grond' }, { id: 't2', project_id: 'p1', naam: 'Dak' }, { id: 't3', project_id: 'p1', naam: 'Gevels' }],
    fotoUrl: pad => `https://opslag/${pad}`,
  })

  it('toont alleen zijn open punten, met het nummer zoals bij BbDW', () => {
    expect(inhoud.punten.map(p => [p.id, p.nummer])).toEqual([['elders', 1], ['open', 2]])
    expect(inhoud.punten.find(p => p.id === 'open')).toMatchObject({ foto: 'https://opslag/p1/open.jpg', tekening_id: 't1', tekening_x: 0.4 })
  })
  it('toont alleen de projecten waarop hij open punten heeft, en alleen tekeningen met zijn punten', () => {
    expect(inhoud.projecten.map(p => p.naam)).toEqual(['Almere Zorgplein', 'Apeldoorn Vlijtseweg'])
    expect(inhoud.tekeningen.map(t => t.id)).toEqual(['t1'])
  })
  it('geeft geen interne velden mee', () => {
    const tekst = JSON.stringify(inhoud)
    for (const veld of ['aangemaakt_door', 'opgelost_door', 'leverancier_id', 'foto":"p1', 'pad', 'code', 'token']) expect(tekst).not.toContain(veld)
    expect(inhoud).toMatchObject({ leverancier: { naam: 'Klimaattechniek Oost', vak: 'Installateur' }, gedeeld_door: 'Michiel', geldig_tot: '2026-11-12T10:00:00Z' })
  })
})

describe('deellink in de proefversie', () => {
  const nu = new Date()
  const gegevens = maakDemoGegevens(nu, projecten)
  const bron = maakDemoBron({ door: 'Jij', naam: 'Testgebruiker', gegevens })
  const open = (lev: string) => gegevens.controlepunten.filter(p => p.leverancier_id === lev && !p.opgelost)
  const lev = gegevens.leveranciers.map(l => l.id).sort((a, b) => open(b).length - open(a).length)[0]!
  const zonder = gegevens.leveranciers.find(l => !open(l.id).length)!

  it('maakt alleen een link voor een leverancier met open punten', async () => {
    await expect(bron.maakDeellink(zonder.id)).rejects.toThrow(/geen open aandachtspunten/)
    const l = await bron.maakDeellink(lev)
    expect(l.token).toMatch(TOKEN_VORM)
    expect(l.code).toMatch(CODE_VORM)
    expect(l.aangemaakt_door).toBe('Testgebruiker')
    expect(new Date(l.geldig_tot).getTime()).toBe(plusMaand(new Date(l.aangemaakt_op)).getTime())
  })

  it('vraagt de code, telt foute pogingen, en toont daarna alleen de open punten van die leverancier', async () => {
    const [l] = await bron.deellinks()
    expect(await bron.externeInhoud(l!.token, '')).toEqual({ stand: 'code', fout: false, over: 10 })
    const fout = l!.code === '22222' ? '33333' : '22222'
    expect(await bron.externeInhoud(l!.token, fout)).toEqual({ stand: 'code', fout: true, over: 9 })
    const a = await bron.externeInhoud(l!.token, l!.code) as Extract<ExternAntwoord, { stand: 'open' }>
    expect(a.stand).toBe('open')
    expect(a.inhoud.punten.map(p => p.id).sort()).toEqual(open(lev).map(p => p.id).sort())
    expect(new Set(a.inhoud.projecten.map(p => p.id))).toEqual(new Set(open(lev).map(p => p.project_id)))
    const [na] = await bron.deellinks()
    expect(na).toMatchObject({ foute_pogingen: 0 })
    expect(na!.bekeken_op).not.toBeNull()
    expect(await bron.externeInhoud('b'.repeat(64), l!.code)).toEqual({ stand: 'onbekend' })
  })

  it('geeft een tekening alleen met de juiste code en als er een punt van hem op staat', async () => {
    const [l] = await bron.deellinks()
    const metPlek = open(lev).find(p => p.tekening_id)
    if (metPlek) expect(await bron.externeTekeningUrl(l!.token, l!.code, metPlek.tekening_id!)).toBe('/voorbeeld-tekening.pdf')
    await expect(bron.externeTekeningUrl(l!.token, l!.code, 'tek-bestaat-niet')).rejects.toThrow()
  })

  it('gaat dicht zodra alles is opgelost, en blijft dicht', async () => {
    const [l] = await bron.deellinks()
    const punten = open(lev)
    for (const p of punten) await bron.bewaarControlepunt(p.id, { opgelost: true })
    expect((await bron.deellinks())[0]).toMatchObject({ gesloten_reden: 'opgelost', gesloten_door: 'Jij' })
    expect((await bron.externeInhoud(l!.token, l!.code)).stand).toBe('opgelost')
    await bron.bewaarControlepunt(punten[0]!.id, { opgelost: false })
    expect((await bron.externeInhoud(l!.token, l!.code)).stand).toBe('opgelost')
  })

  it('sluit na tien verkeerde codes, en een ingetrokken link blijft dicht', async () => {
    const l = await bron.maakDeellink(lev)
    const fout = l.code === '22222' ? '33333' : '22222'
    let a: ExternAntwoord = { stand: 'onbekend' }
    for (let i = 0; i < MAX_POGINGEN; i++) a = await bron.externeInhoud(l.token, fout)
    expect(a.stand).toBe('geblokkeerd')
    expect((await bron.externeInhoud(l.token, l.code)).stand).toBe('geblokkeerd')

    const l2 = await bron.maakDeellink(lev)
    await bron.trekDeellinkIn(l2.id)
    expect((await bron.externeInhoud(l2.token, l2.code)).stand).toBe('ingetrokken')
  })
})

describe('proefversie: wat een tester naar de server stuurt', () => {
  const inhoud: ExternInhoud = {
    leverancier: { naam: 'Klimaattechniek Oost', vak: null }, geldig_tot: '2026-11-12T10:00:00.000Z', gedeeld_door: 'Testgebruiker',
    projecten: [{ id: 'p1', naam: 'Apeldoorn Vlijtseweg', plaats: 'Apeldoorn', adres: null }],
    tekeningen: [{ id: 'tek-vlijtseweg', project_id: 'p1', naam: 'Plattegrond' }],
    punten: [{ id: 'c1', project_id: 'p1', nummer: 3, notitie: 'Kitnaad', aangemaakt_op: '2026-10-01T09:00:00.000Z', foto: 'data:image/jpeg;base64,/9j/4AAQ==', tekening_id: 'tek-vlijtseweg', tekening_blad: 1, tekening_x: 0.4, tekening_y: 0.6 }],
  }
  const link: ProefLink = { token: 'a'.repeat(64), code: '23456', geldig_tot: '2026-11-12T10:00:00.000Z', gesloten_reden: null, gesloten_op: null, inhoud, voorbeeld_tekeningen: ['tek-vlijtseweg'] }

  it('neemt een goede link en inhoud over zoals ze zijn', () => {
    expect(schoneProefLink(JSON.parse(JSON.stringify(link)))).toEqual(link)
  })
  it('laat extra velden weg', () => {
    const met = { ...inhoud, geheim: 'x', leverancier: { ...inhoud.leverancier, id: 'lev-1' }, punten: [{ ...inhoud.punten[0], aangemaakt_door: 'Michiel', foto_pad: 'p1/c1.jpg' }] }
    const schoon = schoneInhoud(met)!
    expect(JSON.stringify(schoon)).not.toMatch(/geheim|lev-1|Michiel|foto_pad/)
  })
  it('weigert een verkeerde token, code of tekening-id, en neemt alleen foto\'s als jpg of de voorbeeldfoto', () => {
    expect(schoneProefLink({ ...link, token: 'x'.repeat(64) })).toBeNull()
    expect(schoneProefLink({ ...link, code: '12345' })).toBeNull()
    expect(schoneProefLink({ ...link, inhoud: { ...inhoud, tekeningen: [{ id: '../elders', project_id: 'p1', naam: 'x' }] } })).toBeNull()
    expect(schoneProefLink({ ...link, inhoud: { ...inhoud, punten: [{ ...inhoud.punten[0], project_id: 'p-onbekend' }] } })).toBeNull()
    const foto = (f: unknown) => schoneInhoud({ ...inhoud, punten: [{ ...inhoud.punten[0], foto: f }] })!.punten[0]!.foto
    expect(foto('/voorbeeld-aandachtspunt.jpg')).toBe('/voorbeeld-aandachtspunt.jpg')
    expect(foto('https://elders.example/x.jpg')).toBeNull()
    expect(foto('javascript:alert(1)')).toBeNull()
    expect(foto('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull()
  })
  it('neemt van de server gekeken en pogingen over; dicht blijft dicht', () => {
    const stand: ProefStand = { token: link.token, gesloten_reden: 'geblokkeerd', gesloten_op: '2026-10-20T10:00:00Z', foute_pogingen: 10, bekeken_op: '2026-10-19T10:00:00Z' }
    expect(metProefStand(link_({}), stand)).toMatchObject({ gesloten_reden: 'geblokkeerd', foute_pogingen: 10, bekeken_op: stand.bekeken_op, op_server: true })
    expect(metProefStand(link_({ gesloten_reden: 'ingetrokken', gesloten_op: '2026-10-18T10:00:00Z' }), { ...stand, gesloten_reden: null, gesloten_op: null })).toMatchObject({ gesloten_reden: 'ingetrokken' })
  })
})
const link_ = (extra: Partial<Deellink>) => link(extra)

/** Doet wat server/api/proef doet, in het geheugen; elke vraag gaat als JSON heen en terug, zoals over het net. */
function nepServer() {
  type Rij = ProefLink & { inhoud: ExternInhoud, foute_pogingen: number, bekeken_op: string | null }
  const rijen = new Map<string, Rij>()
  const json = <T>(x: T): T => JSON.parse(JSON.stringify(x))
  const stand = (r: Rij): ProefStand => ({ token: r.token, gesloten_reden: r.gesloten_reden, gesloten_op: r.gesloten_op, foute_pogingen: r.foute_pogingen, bekeken_op: r.bekeken_op })
  const uploads: string[] = []
  const server: ProefServer = {
    async bewaar(l) {
      const s = schoneProefLink(json(l))!
      const oud = rijen.get(s.token)
      if (!oud) {
        if (s.inhoud) rijen.set(s.token, { ...s, inhoud: s.inhoud, foute_pogingen: 0, bekeken_op: null })
      } else {
        if (s.inhoud) Object.assign(oud, { inhoud: s.inhoud, voorbeeld_tekeningen: s.voorbeeld_tekeningen })
        if (!oud.gesloten_reden && s.gesloten_reden) Object.assign(oud, { gesloten_reden: s.gesloten_reden, gesloten_op: s.gesloten_op })
      }
      const r = rijen.get(s.token)
      return r ? [json(stand(r))] : []
    },
    async uploadTekening(token, id) { uploads.push(`${token}/${id}`) },
    async inhoud(token, code) {
      const r = rijen.get(token)
      if (!r) return { stand: 'onbekend' }
      const nu = new Date()
      const st = standVan(r, nu)
      if (st !== 'open') return dichtAntwoord(r, st)
      const { wijziging, antwoord } = controleerCode(r, code, code === r.code, nu)
      if (wijziging) Object.assign(r, wijziging)
      return json(antwoord ?? { stand: 'open', inhoud: r.inhoud })
    },
    async tekeningUrl(token, _code, id) { return rijen.get(token)?.voorbeeld_tekeningen.includes(id) ? '/voorbeeld-tekening.pdf' : 'getekend-adres' },
  }
  return { server, rijen, uploads }
}

describe('proefversie: de link op een ander apparaat', () => {
  const gegevens = maakDemoGegevens(new Date(), projecten)
  const { server, rijen } = nepServer()
  const tester = maakDemoBron({ door: 'Jij', naam: 'Testgebruiker', gegevens, server })
  // Een ander apparaat zonder de gegevens van de tester (geen wachtwoord van de proefversie).
  const leverancierBron = maakDemoBron({ gegevens: null, server })
  const open = (lev: string) => gegevens.controlepunten.filter(p => p.leverancier_id === lev && !p.opgelost)
  const vlijtseweg = gegevens.projecten.find(p => p.nummer === 'P20038')!.id
  const lev = gegevens.leveranciers.map(l => l.id).filter(id => open(id).some(p => p.project_id === vlijtseweg)).sort((a, b) => open(b).length - open(a).length)[0]!
  const wachtOpServer = () => new Promise(r => setTimeout(r, 700))
  let l: Deellink

  it('zet een nieuwe link meteen op de server, met alleen wat de leverancier mag zien', async () => {
    l = await tester.maakDeellink(lev)
    expect(l.op_server).toBe(true)
    const rij = rijen.get(l.token)!
    expect(rij.code).toBe(l.code)
    expect(rij.inhoud.punten.map(p => p.id).sort()).toEqual(open(lev).map(p => p.id).sort())
    expect(rij.voorbeeld_tekeningen).toEqual(['tek-vlijtseweg'])
  })

  it('opent op het andere apparaat met de code, en de tester ziet daarna dat er is gekeken', async () => {
    expect(await leverancierBron.externeInhoud(l.token, '')).toEqual({ stand: 'code', fout: false, over: 10 })
    const a = await leverancierBron.externeInhoud(l.token, l.code) as Extract<ExternAntwoord, { stand: 'open' }>
    expect(a.stand).toBe('open')
    expect(a.inhoud.leverancier.naam).toBe(gegevens.leveranciers.find(x => x.id === lev)!.naam)
    expect(await leverancierBron.externeTekeningUrl(l.token, l.code, 'tek-vlijtseweg')).toBe('/voorbeeld-tekening.pdf')
    const [bijTester] = await tester.deellinks()
    expect(bijTester!.bekeken_op).not.toBeNull()
  })

  it('werkt de kopie bij als de tester iets verandert, en sluit hem als alles is opgelost', async () => {
    const punten = open(lev)
    await tester.bewaarControlepunt(punten[0]!.id, { opgelost: true })
    await wachtOpServer()
    expect(rijen.get(l.token)!.inhoud.punten.map(p => p.id)).not.toContain(punten[0]!.id)
    for (const p of punten.slice(1)) await tester.bewaarControlepunt(p.id, { opgelost: true })
    await wachtOpServer()
    expect(rijen.get(l.token)!.gesloten_reden).toBe('opgelost')
    expect((await leverancierBron.externeInhoud(l.token, l.code)).stand).toBe('opgelost')
  })

  it('neemt een blokkade van de server over', async () => {
    await tester.bewaarControlepunt(open(lev)[0]?.id ?? gegevens.controlepunten.find(p => p.leverancier_id === lev)!.id, { opgelost: false })
    const l2 = await tester.maakDeellink(lev)
    const fout = l2.code === '22222' ? '33333' : '22222'
    for (let i = 0; i < MAX_POGINGEN; i++) await leverancierBron.externeInhoud(l2.token, fout)
    const bijTester = (await tester.deellinks()).find(x => x.id === l2.id)!
    expect(bijTester.gesloten_reden).toBe('geblokkeerd')
  })

  it('werkt zonder server alleen in de eigen browser', async () => {
    const kapot: ProefServer = { ...server, bewaar: () => Promise.reject(new Error('weg')) }
    const b = maakDemoBron({ gegevens: maakDemoGegevens(new Date(), projecten), server: kapot })
    expect((await b.maakDeellink(lev)).op_server).toBe(false)
  })
})

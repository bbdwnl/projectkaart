import { beforeEach, describe, expect, it } from 'vitest'
import projecten from '~/data/projecten.json'
import type { Bron } from '~/data/bron'
import type { Actie, Opmerking, Project, Taak } from '~/lib/types'
import { leegTaak } from '~/lib/taak'
import { createHash } from 'node:crypto'
import { hashVan, isToken, maakToken, ontsleutel, toegangUitKop, versleutel } from '../server/mcp/sleutel'
import { clientUit, emailUitToken, leesRegistratie, pkceKlopt, redirectPast, redirectSoort, resourceMetadata, serverMetadata, terugNaar } from '../server/mcp/oauth'
import { PROTOCOL_VERSIES, verwerk, type ServerInfo } from '../server/mcp/protocol'
import { instructies, maakGereedschap, vindProject, type Context } from '../server/mcp/gereedschap'
import { maakDemoGegevens, type DemoGegevens } from './voorbeeldgegevens'

const GEHEIM = 'een-geheim-van-minstens-tweeëndertig-tekens-lang'
const APP = 'https://kaart.example'

describe('copilot-tokens', () => {
  it('zijn lang, willekeurig en herkenbaar, en de database krijgt alleen een hash', () => {
    const a = maakToken('toegang')
    expect(isToken('toegang', a)).toBe(true)
    expect(isToken('ververs', a)).toBe(false)
    expect(a).not.toBe(maakToken('toegang'))
    expect(hashVan(a)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashVan(a)).toBe(hashVan(a))
  })
  it('leest alleen een access token uit de kop Authorization', () => {
    const t = maakToken('toegang')
    expect(toegangUitKop(`Bearer ${t}`)).toBe(t)
    expect(toegangUitKop(`bearer ${t} `)).toBe(t)
    expect(toegangUitKop(t)).toBeNull()
    expect(toegangUitKop(`Bearer ${maakToken('ververs')}`)).toBeNull()
    expect(toegangUitKop('Bearer eyJhbGciOi.iets.anders')).toBeNull()
    expect(toegangUitKop(undefined)).toBeNull()
  })
  it('versleutelt de sessie; met een ander geheim of na knoeien komt er niets uit', () => {
    const v = versleutel('verversingstoken-123', GEHEIM)
    expect(v).not.toContain('verversingstoken')
    expect(ontsleutel(v, GEHEIM)).toBe('verversingstoken-123')
    expect(versleutel('x', GEHEIM)).not.toBe(versleutel('x', GEHEIM))
    expect(ontsleutel(v, `${GEHEIM}!`)).toBeNull()
    const [a, iv, tag, data] = v.split('.')
    expect(ontsleutel([a, iv, tag, `${data!.slice(0, -2)}AA`].join('.'), GEHEIM)).toBeNull()
    expect(ontsleutel('onzin', GEHEIM)).toBeNull()
    expect(() => versleutel('x', 'kort')).toThrow(/32/)
  })
})

describe('oauth', () => {
  it('wijst Copilot de weg: resource, autorisatieserver en PKCE', () => {
    expect(resourceMetadata(APP)).toMatchObject({ resource: `${APP}/api/mcp`, authorization_servers: [APP] })
    expect(serverMetadata(APP)).toMatchObject({
      issuer: APP, authorization_endpoint: `${APP}/koppelen`, token_endpoint: `${APP}/api/oauth/token`,
      registration_endpoint: `${APP}/api/oauth/registreren`, code_challenge_methods_supported: ['S256'],
    })
  })
  it('laat alleen Microsoft, VS Code en deze computer als terugadres toe', () => {
    expect(redirectSoort('https://global.consent.azure-apim.net/redirect/mcp-projectkaart')).toBe('microsoft')
    expect(redirectSoort('https://europe-002.consent.azure-apim.net/redirect')).toBe('microsoft')
    expect(redirectSoort('https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect')).toBe('microsoft')
    expect(redirectSoort('https://teams.microsoft.com/api/anders')).toBeNull()
    expect(redirectSoort('https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect?naar=evil')).toBeNull()
    expect(redirectSoort('https://vscode.dev/redirect')).toBe('vscode')
    expect(redirectSoort('http://127.0.0.1:33418/')).toBe('lokaal')
    expect(redirectSoort('https://consent.azure-apim.net.evil.example/redirect')).toBeNull()
    expect(redirectSoort('https://evil.example/consent.azure-apim.net')).toBeNull()
    expect(redirectSoort('http://global.consent.azure-apim.net/redirect')).toBeNull()
    expect(redirectSoort('https://vscode.dev/anders')).toBeNull()
    expect(redirectSoort('https://user:pw@vscode.dev/redirect')).toBeNull()
    expect(redirectSoort('javascript:alert(1)')).toBeNull()
  })
  it('vergelijkt het terugadres precies, behalve de poort op deze computer', () => {
    const reg = ['https://global.consent.azure-apim.net/redirect/x', 'http://127.0.0.1:33418/']
    expect(redirectPast(reg, 'https://global.consent.azure-apim.net/redirect/x')).toBe(true)
    expect(redirectPast(reg, 'https://global.consent.azure-apim.net/redirect/y')).toBe(false)
    expect(redirectPast(reg, 'http://127.0.0.1:51234/')).toBe(true)
    expect(redirectPast(reg, 'http://127.0.0.1:51234/anders')).toBe(false)
  })
  it('controleert PKCE (S256)', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    expect(pkceKlopt(verifier, challenge)).toBe(true)
    expect(pkceKlopt(`${verifier}x`, challenge)).toBe(false)
    expect(pkceKlopt('kort', challenge)).toBe(false)
    expect(pkceKlopt(undefined, challenge)).toBe(false)
  })
  it('registreert Copilot Studio met een geheim en VS Code zonder; vreemde adressen niet', () => {
    expect(leesRegistratie({ client_name: 'Copilot Studio', redirect_uris: ['https://global.consent.azure-apim.net/redirect/a'] }))
      .toEqual({ naam: 'Copilot Studio', redirectUris: ['https://global.consent.azure-apim.net/redirect/a'], publiek: false })
    expect(leesRegistratie({ redirect_uris: ['http://127.0.0.1:33418/', 'https://vscode.dev/redirect'], token_endpoint_auth_method: 'none' }))
      .toMatchObject({ naam: 'Copilot', publiek: true })
    expect(leesRegistratie({ redirect_uris: ['https://evil.example/cb'] })).toMatchObject({ fout: 'invalid_redirect_uri' })
    expect(leesRegistratie({ redirect_uris: [] })).toMatchObject({ fout: 'invalid_redirect_uri' })
    expect(leesRegistratie({ redirect_uris: ['https://vscode.dev/redirect'], grant_types: ['client_credentials'] })).toMatchObject({ fout: 'invalid_client_metadata' })
    expect(leesRegistratie({ redirect_uris: ['https://vscode.dev/redirect'], token_endpoint_auth_method: 'private_key_jwt' })).toMatchObject({ fout: 'invalid_client_metadata' })
  })
  it('leest de client uit Basic of uit het formulier', () => {
    const basic = `Basic ${Buffer.from('pkc_abc:pks_geheim').toString('base64')}`
    expect(clientUit(basic, {})).toEqual({ id: 'pkc_abc', geheim: 'pks_geheim' })
    expect(clientUit(undefined, { client_id: 'pkc_abc', client_secret: 'pks_x' })).toEqual({ id: 'pkc_abc', geheim: 'pks_x' })
    expect(clientUit(undefined, { client_id: 'pkc_abc' })).toEqual({ id: 'pkc_abc', geheim: null })
    expect(clientUit(undefined, {})).toBeNull()
  })
  it('stuurt terug met code, state en de uitgever', () => {
    const u = new URL(terugNaar('https://vscode.dev/redirect?x=1', { code: 'pkg_c', state: 's t', error: undefined }, APP))
    expect(Object.fromEntries(u.searchParams)).toEqual({ x: '1', code: 'pkg_c', state: 's t', iss: APP })
  })
  it('leest het e-mailadres uit een token van Supabase', () => {
    const jwt = ['x', Buffer.from(JSON.stringify({ email: 'michiel@bbdw.nl' })).toString('base64url'), 'y'].join('.')
    expect(emailUitToken(jwt)).toBe('michiel@bbdw.nl')
    expect(emailUitToken('onzin')).toBeNull()
  })
})

describe('mcp-protocol', () => {
  const server: ServerInfo = {
    naam: 'projectkaart', versie: '1.0.0', instructies: 'Werk netjes.',
    gereedschap: [
      { name: 'echo', title: 'Echo', description: 'Geeft terug', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true, openWorldHint: false }, run: async a => ({ terug: a }) },
      { name: 'stuk', title: 'Stuk', description: 'Gaat mis', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true, openWorldHint: false }, run: async () => { throw new Error('Dat mag niet.') } },
    ],
  }

  it('spreekt de versie van de client als we die kennen, anders de nieuwste', async () => {
    const init = (v: string) => verwerk({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: v, capabilities: {}, clientInfo: { name: 't', version: '1' } } }, server)
    expect(await init('2025-06-18')).toMatchObject({ id: 1, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, instructions: 'Werk netjes.' } })
    expect(await init('1999-01-01')).toMatchObject({ result: { protocolVersion: PROTOCOL_VERSIES[0] } })
  })
  it('geeft geen antwoord op een melding', async () => {
    expect(await verwerk({ jsonrpc: '2.0', method: 'notifications/initialized' }, server)).toBeNull()
  })
  it('toont het gereedschap zonder de code', async () => {
    const r = await verwerk({ jsonrpc: '2.0', id: 'a', method: 'tools/list' }, server) as { result: { tools: object[] } }
    expect(r.result.tools.map(t => Object.keys(t))).toEqual([['name', 'title', 'description', 'inputSchema', 'annotations'], ['name', 'title', 'description', 'inputSchema', 'annotations']])
  })
  it('roept gereedschap aan; een fout komt terug als tekst, een onbekend gereedschap als protocolfout', async () => {
    expect(await verwerk({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'echo', arguments: { x: 1 } } }, server))
      .toMatchObject({ result: { isError: false, content: [{ type: 'text', text: expect.stringContaining('"x": 1') }] } })
    expect(await verwerk({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'stuk' } }, server))
      .toMatchObject({ result: { isError: true, content: [{ text: 'Dat mag niet.' }] } })
    expect(await verwerk({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'bestaat-niet' } }, server)).toMatchObject({ error: { code: -32602 } })
    expect(await verwerk({ jsonrpc: '2.0', id: 5, method: 'resources/list' }, server)).toMatchObject({ error: { code: -32601 } })
    expect(await verwerk({ hallo: 'wereld' }, server)).toMatchObject({ error: { code: -32600 } })
  })
  it('verwerkt een reeks berichten, zonder antwoord op meldingen', async () => {
    const r = await verwerk([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }], server)
    expect(r).toEqual([{ jsonrpc: '2.0', id: 1, result: {} }])
  })
})

// Een bron in het geheugen, met de voorbeeldgegevens. Wie en wanneer zet hij zoals de database dat doet.
function geheugenBron(g: DemoGegevens, wie: string): Bron {
  const nu = () => new Date().toISOString()
  const taakNa = (t: Taak, w: Partial<Taak>) => {
    const oud = t.status
    Object.assign(t, w, { gewijzigd_door: wie })
    if (t.status === 'definitief' && oud !== 'definitief') Object.assign(t, { afgetekend_door: wie, afgetekend_op: nu() })
    if (t.status !== 'definitief') Object.assign(t, { afgetekend_door: null, afgetekend_op: null })
    return t
  }
  const bron: Partial<Bron> = {
    projecten: async () => g.projecten,
    taken: async id => (id ? g.taken.filter(t => t.project_id === id) : g.taken),
    uitzonderingen: async () => g.uitzonderingen,
    acties: async id => (id ? g.acties.filter(a => a.project_id === id) : g.acties),
    controlepunten: async id => (id ? g.controlepunten.filter(c => c.project_id === id) : g.controlepunten),
    opmerkingen: async id => g.opmerkingen.filter(o => o.project_id === id),
    logboek: async (id, n = 40) => g.logboek.filter(l => l.project_id === id).slice(0, n),
    instellingen: async () => [],
    bewaarTaak: async (id, w) => taakNa(g.taken.find(t => t.id === id)!, w),
    bewaarStandaardtaak: async (pid, lijst, sleutel, w) => {
      let t = g.taken.find(x => x.project_id === pid && x.lijst === lijst && x.sleutel === sleutel)
      if (!t) g.taken.push(t = leegTaak({ id: `t-nieuw-${g.taken.length}`, project_id: pid, fase: lijst, lijst, sleutel }))
      return taakNa(t, w)
    },
    plaatsOpmerking: async (taakId, tekst) => {
      const t = g.taken.find(x => x.id === taakId)!
      const o: Opmerking = { id: `o-${g.opmerkingen.length}`, taak_id: taakId, project_id: t.project_id, tekst, door: wie, op: nu() }
      g.opmerkingen.push(o)
      return o
    },
    bewaarProject: async (id, w) => Object.assign(g.projecten.find(p => p.id === id)!, w),
    nieuweActie: async (pid, w = {}) => {
      const a: Actie = { id: `a-${g.acties.length}`, project_id: pid, tekst: '', actiehouder: null, deadline: null, gereed: false, gereed_door: null, gereed_op: null, aangemaakt_door: wie, aangemaakt_op: nu(), ...w }
      g.acties.push(a)
      return a
    },
    bewaarActie: async (id, w) => {
      const a = g.acties.find(x => x.id === id)!
      Object.assign(a, w)
      if (w.gereed) Object.assign(a, { gereed_door: wie, gereed_op: nu() })
      return a
    },
  }
  return bron as Bron
}

describe('copilot-gereedschap', () => {
  const nu = new Date(2026, 10, 26)
  let g: DemoGegevens
  let ctx: Context
  let server: ServerInfo
  const roep = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await verwerk({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, server) as { result: { isError: boolean, content: { text: string }[] } }
    const tekst = r.result.content[0]!.text
    return { fout: r.result.isError, tekst, data: r.result.isError ? null : JSON.parse(tekst) }
  }

  beforeEach(() => {
    g = maakDemoGegevens(nu, projecten)
    ctx = { bron: geheugenBron(g, 'Michiel'), nu, gebruiker: { naam: 'Michiel', email: 'michiel@bbdw.nl', isMt: false }, appUrl: 'https://kaart.example', geldigTot: '2026-12-03T10:00:00Z' }
    server = { naam: 'projectkaart', versie: '1.0.0', instructies: instructies(ctx), gereedschap: maakGereedschap(ctx) }
  })

  it('vertelt Copilot namens wie het werkt', () => {
    expect(server.instructies).toContain('namens Michiel')
    expect(server.instructies).toContain('logboek op naam van Michiel')
  })

  it('vindt een project op nummer, naam of een uniek deel; bij twijfel noemt het de kandidaten', () => {
    const ps = g.projecten as Project[]
    const p = ps.find(x => x.nummer === 'P20038')!
    expect(vindProject(ps, 'p20038').id).toBe(p.id)
    expect(vindProject(ps, p.naam.toUpperCase()).id).toBe(p.id)
    expect(() => vindProject(ps, 'gezondheid')).toThrow(/past bij \d+ projecten/)
    expect(() => vindProject(ps, 'bestaat-echt-niet')).toThrow(/Geen project/)
  })

  it('zoekt projecten met hun stand, het dringendste eerst', async () => {
    const { data } = await roep('projecten_zoeken', { alleen_aandacht: true })
    expect(data.aantal).toBeGreaterThan(0)
    expect(data.projecten[0]).toMatchObject({ stand: expect.any(String), taken: expect.any(Object), link: expect.stringMatching(/^https:\/\/kaart\.example\/projecten\//) })
    const telaat = data.projecten.map((p: { taken: { te_laat: number } }) => p.taken.te_laat)
    expect(telaat[0]).toBe(Math.max(...telaat))
  })

  it('toont een kaart met de open taken van de huidige fase, met id', async () => {
    const { data } = await roep('project_bekijken', { project: 'P20038' })
    expect(data.project).toMatchObject({ nummer: 'P20038', fase: expect.any(String), stand: expect.any(String) })
    expect(data.taken.length).toBeGreaterThan(0)
    for (const t of data.taken) expect(['Te laat', 'Let op', 'Open']).toContain(t.stand)
    expect(data.taken[0].id).toMatch(/^(std|uitz):/)
    expect(data.overdracht.eisen.length).toBeGreaterThan(0)
  })

  it('tekent een taak af op naam van de gebruiker, en het stoplicht rekent mee', async () => {
    const kaart = (await roep('project_bekijken', { project: 'P20038' })).data
    const taak = kaart.taken[0]
    const { data } = await roep('taak_bijwerken', { project: 'P20038', taak: taak.id, status: 'definitief', eigenaar: 'benno' })
    expect(data).toMatchObject({ opgeslagen: true, door: 'Michiel', taak: { id: taak.id, stand: 'Klaar', status: 'Definitief', eigenaar: 'Benno', afgetekend: expect.stringMatching(/^Michiel op /) } })
  })

  it('weigert wat op de kaart ook niet kan, met uitleg', async () => {
    const kaart = (await roep('project_bekijken', { project: 'P20038', filter: 'alles' })).data
    const std = kaart.taken.find((t: { id: string }) => t.id.startsWith('std:'))
    const fouten = await Promise.all([
      roep('taak_bijwerken', { project: 'P20038', taak: std.id, status: 'nvt', reden_nvt: null }),
      roep('taak_bijwerken', { project: 'P20038', taak: std.id, eigenaar: 'Onbekende Collega' }),
      roep('taak_bijwerken', { project: 'P20038', taak: std.id, deadline: '2026-12-01' }),
      roep('taak_bijwerken', { project: 'P20038', taak: std.id, document_url: 'javascript:alert(1)' }),
      roep('taak_bijwerken', { project: 'P20038', taak: std.id }),
      roep('project_bijwerken', { project: 'P20038', pm: 'Iemand' }),
      roep('project_bijwerken', { project: 'P20038', datum_afbouw: '31-12-2026' }),
      roep('project_bijwerken', { project: 'P20038', afgehandeld: true }),
    ])
    expect(fouten.map(f => f.fout)).toEqual(fouten.map(() => true))
    expect(fouten[0]!.tekst).toMatch(/reden/)
    expect(fouten[1]!.tekst).toMatch(/Kies uit: .*Benno/)
    expect(fouten[2]!.tekst).toMatch(/projectdatums/)
    expect(fouten[5]!.tekst).toMatch(/projectmanager/)
  })

  it('werkt projectdatums en rollen bij, en zet een leeg veld met null', async () => {
    const { data } = await roep('project_bijwerken', { project: 'P20038', datum_afbouw: '2027-03-01', pm: 'carlo', opzichter: null, prio: true })
    expect(data).toMatchObject({ opgeslagen: true, gewijzigd: ['datum_afbouw', 'pm', 'opzichter', 'prio'] })
    expect(g.projecten.find(p => p.nummer === 'P20038')).toMatchObject({ datum_afbouw: '2027-03-01', pm: 'Carlo', opzichter: null, prio: true })
  })

  it('plaatst een opmerking en beheert acties op nummer', async () => {
    const kaart = (await roep('project_bekijken', { project: 'P20038', filter: 'alles' })).data
    const op = await roep('opmerking_plaatsen', { project: 'P20038', taak: kaart.taken[0].id, tekst: 'Navragen bij de architect.' })
    expect(op.data).toMatchObject({ geplaatst: true, door: 'Michiel' })
    expect((await roep('opmerkingen_bekijken', { project: 'P20038', taak: kaart.taken[0].id })).data.opmerkingen.at(-1)).toMatchObject({ tekst: 'Navragen bij de architect.' })

    const voor = g.acties.filter(a => a.project_id === g.projecten.find(p => p.nummer === 'P20038')!.id).length
    const nieuw = await roep('actie_toevoegen', { project: 'P20038', tekst: 'Offerte kozijnen opvragen', actiehouder: 'Michiel', deadline: '2026-12-10' })
    expect(nieuw.data.actie).toMatchObject({ nummer: voor + 1, tekst: 'Offerte kozijnen opvragen', actiehouder: 'Michiel' })
    const klaar = await roep('actie_bijwerken', { project: 'P20038', nummer: voor + 1, gereed: true })
    expect(klaar.data.actie.gereed).toMatch(/^Michiel op /)
    expect((await roep('actie_bijwerken', { project: 'P20038', nummer: 999, gereed: true })).fout).toBe(true)
  })
})

describe('extra terugadressen (NUXT_COPILOT_TERUGADRESSEN)', () => {
  it('laat een extra host van Microsoft toe, alleen met https, en daarna weer niet', async () => {
    const { zetExtraTerugadressen } = await import('../server/mcp/oauth')
    expect(redirectSoort('https://redirect.voorbeeld.microsoft.com/cb')).toBeNull()
    zetExtraTerugadressen(' .voorbeeld.microsoft.com , precies.example ,onzin met spatie')
    expect(redirectSoort('https://redirect.voorbeeld.microsoft.com/cb')).toBe('microsoft')
    expect(redirectSoort('https://precies.example/cb')).toBe('microsoft')
    expect(redirectSoort('https://niet.precies.example/cb')).toBeNull()
    expect(redirectSoort('http://redirect.voorbeeld.microsoft.com/cb')).toBeNull()
    zetExtraTerugadressen('')
    expect(redirectSoort('https://precies.example/cb')).toBeNull()
  })
})

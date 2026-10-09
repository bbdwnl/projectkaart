import { describe, expect, it } from 'vitest'
import { GEEN_FILTER, kansGroep, leadsVan, leegProject, leesQuery, maakSlug, naarQuery, past, sorteer, STANDAARD_SORTERING, type Lead } from '~/lib/leads'
import { geleden } from '~/lib/datum'
import { leegTaak } from '~/lib/taak'
import type { Project } from '~/lib/types'

const nu = new Date(2026, 9, 9)
const project = (naam: string, extra: Partial<Project> = {}) => leegProject({ id: naam, slug: maakSlug(naam, []), naam, ...extra })
const lead = (naam: string, extra: Partial<Project> = {}, licht: Lead['licht'] = 'open', laatst: string | null = null): Lead =>
  ({ p: project(naam, extra), licht, open: [], laatst })

describe('leadsVan', () => {
  const brink = project('De Brink', { gewijzigd_op: '2026-09-01T10:00:00Z' })
  const anker = project('Het Anker')
  const lopend = project('Vlijtseweg', { fase: 'ontwikkeling' })
  const taken = [
    leegTaak({ id: 't1', project_id: brink.id, fase: 'lead', lijst: 'lead', sleutel: 'betaalde_opdracht', status: 'definitief', document_naam: 'Opdracht.pdf', gewijzigd_op: '2026-10-02T08:00:00+00:00' }),
    leegTaak({ id: 't2', project_id: anker.id, fase: 'lead', lijst: 'lead', sleutel: 'betaalde_opdracht', status: 'definitief', document_naam: 'Opdracht.pdf' }),
    leegTaak({ id: 't3', project_id: anker.id, fase: 'lead', lijst: 'lead', sleutel: 'risico', status: 'definitief', document_naam: 'Risico.docx' }),
  ]
  const leads = leadsVan([brink, anker, lopend], taken, [], nu)

  it('neemt alleen projecten in de fase lead', () => {
    expect(leads.map(l => l.p.naam)).toEqual(['De Brink', 'Het Anker'])
  })
  it('zegt wat er nog open is voor de overdracht', () => {
    expect(leads[0]).toMatchObject({ licht: 'open', open: ['Analyse risico\'s & kansen'] })
    expect(leads[1]).toMatchObject({ licht: 'klaar', open: [] })
  })
  it('neemt de laatste wijziging van het project of een van zijn taken', () => {
    expect(leads[0]!.laatst).toBe('2026-10-02T08:00:00+00:00')
    expect(leads[1]!.laatst).toBeNull()
  })
})

describe('filteren', () => {
  const leads = [
    lead('De Brink', { am: 'Jeroen', slagingskans: 75, prio: true, plaats: 'Zwolle' }, 'klaar'),
    lead('Het Anker', { am: 'Peter', slagingskans: 50 }),
    lead('Molenwijk', { slagingskans: null }),
  ]
  const namen = (f: Partial<typeof GEEN_FILTER>) => leads.filter(l => past(l, { ...GEEN_FILTER, ...f })).map(l => l.p.naam)

  it('laat zonder filter alles zien', () => expect(namen({})).toHaveLength(3))
  it('zoekt in naam en plaats, zonder op hoofdletters te letten', () => {
    expect(namen({ zoek: ' zwolle ' })).toEqual(['De Brink'])
    expect(namen({ zoek: 'ANKER' })).toEqual(['Het Anker'])
  })
  it('filtert op accountmanager, ook op leads zonder', () => {
    expect(namen({ am: 'Peter' })).toEqual(['Het Anker'])
    expect(namen({ am: 'geen' })).toEqual(['Molenwijk'])
  })
  it('filtert op kans, prio en klaar voor overdracht, en combineert', () => {
    expect(namen({ kans: 'onbekend' })).toEqual(['Molenwijk'])
    expect(namen({ prio: true })).toEqual(['De Brink'])
    expect(namen({ klaar: true, am: 'Peter' })).toEqual([])
  })
  it('deelt de kans in groepen', () => {
    expect([0, 25, 50, 75, 100, null].map(kansGroep)).toEqual(['laag', 'laag', 'midden', 'hoog', 'hoog', 'onbekend'])
  })
})

describe('sorteren', () => {
  const leads = [
    lead('Bergen', { slagingskans: 50, m2: 400 }, 'open', '2026-09-01T00:00:00Z'),
    lead('Assen', { slagingskans: null, m2: 900 }),
    lead('Cuijk', { slagingskans: 50, prio: true }, 'open', '2026-10-01T00:00:00Z'),
    lead('Doetinchem', { slagingskans: 100 }),
  ]
  const volgorde = (kolom: Parameters<typeof sorteer>[1]['kolom'], af: boolean) => sorteer(leads, { kolom, af }).map(l => l.p.naam)

  it('zet de hoogste kans bovenaan, bij gelijke kans prio eerst, en onbekend onderaan', () => {
    expect(volgorde('kans', true)).toEqual(['Doetinchem', 'Cuijk', 'Bergen', 'Assen'])
  })
  it('houdt lege waarden onderaan, ook andersom', () => {
    expect(volgorde('kans', false)).toEqual(['Cuijk', 'Bergen', 'Doetinchem', 'Assen'])
    expect(volgorde('m2', true)).toEqual(['Assen', 'Bergen', 'Cuijk', 'Doetinchem'])
    expect(volgorde('laatst', true)).toEqual(['Cuijk', 'Bergen', 'Assen', 'Doetinchem'])
  })
  it('sorteert op naam', () => {
    expect(volgorde('naam', false)).toEqual(['Assen', 'Bergen', 'Cuijk', 'Doetinchem'])
  })
})

describe('adresbalk', () => {
  it('laat de standaard weg', () => {
    expect(naarQuery({ ...GEEN_FILTER }, { ...STANDAARD_SORTERING })).toEqual({})
  })
  it('schrijft en leest dezelfde filters en sortering', () => {
    const filter = { zoek: 'de brink', am: 'Jeroen', kans: 'hoog' as const, prio: true, klaar: true }
    const q = naarQuery(filter, { kolom: 'naam', af: true })
    expect(q).toEqual({ zoek: 'de brink', am: 'Jeroen', kans: 'hoog', prio: '1', klaar: '1', sort: 'naam', richting: 'af' })
    expect(leesQuery(q)).toEqual({ filter, sortering: { kolom: 'naam', af: true } })
  })
  it('maakt van onbekende waarden de standaard', () => {
    expect(leesQuery({ kans: 'heel-hoog', sort: 'constructor', prio: 'ja', am: ['Peter', 'Jeroen'] })).toEqual({
      filter: { ...GEEN_FILTER, am: 'Peter' },
      sortering: STANDAARD_SORTERING,
    })
  })
})

describe('maakSlug', () => {
  it('maakt een nette slug, zonder accenten', () => {
    expect(maakSlug('Gezondheidscentrum  Café De Brink!', [])).toBe('gezondheidscentrum-cafe-de-brink')
  })
  it('telt door als hij al bestaat', () => {
    expect(maakSlug('De Brink', ['de-brink', 'de-brink-2'])).toBe('de-brink-3')
  })
  it('geeft altijd iets bruikbaars', () => {
    expect(maakSlug('—', [])).toBe('lead')
  })
})

describe('geleden', () => {
  it('rekent grof terug vanaf vandaag', () => {
    expect(geleden(new Date(2026, 9, 9, 15).toISOString(), nu)).toBe('Vandaag')
    expect(geleden(new Date(2026, 9, 8, 9).toISOString(), nu)).toBe('Gisteren')
    expect(geleden(new Date(2026, 9, 1).toISOString(), nu)).toBe('8 dagen geleden')
    expect(geleden(new Date(2026, 8, 11).toISOString(), nu)).toBe('4 weken geleden')
    expect(geleden(new Date(2026, 5, 1).toISOString(), nu)).toBe('4 maanden geleden')
  })
})

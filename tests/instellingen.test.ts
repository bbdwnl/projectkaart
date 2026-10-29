import { afterEach, describe, expect, it } from 'vitest'
import { EIGENAREN, EISEN, FASEN, MENSEN, SOORTEN, faseInfo } from '~/lib/fasen'
import { huidig, lees, nieuweCode, pasToe, standaard } from '~/lib/instellingen'
import { LIJSTEN, vindStandaardtaak } from '~/lib/taken'
import { STATUSSEN, statusNaam } from '~/lib/taak'
import { eisStand } from '~/lib/stoplicht'

describe('instellingen', () => {
  afterEach(() => pasToe([]))

  it('begint met de lijsten uit de code', () => {
    expect(huidig()).toEqual(standaard())
    expect(standaard().mensen.rollen.pm).toEqual(['Benno', 'Carlo', 'Dimitry', 'Michiel', 'Patrick'])
    expect(standaard().labels.statussen.niet_gestart).toBe('Niet gestart')
  })

  it('zet de versie uit de database over de lijsten heen, op hun plek, en zonder rij terug naar de standaard', () => {
    const pm = MENSEN.pm
    pasToe([
      { sleutel: 'mensen', waarde: { rollen: { pm: ['Anna', 'Bart'] }, eigenaren: ['Anna'], buddies: [] } },
      { sleutel: 'labels', waarde: { statussen: { niet_gestart: 'Nog niet begonnen' }, fasen: { lead: { naam: 'Kans' } }, soorten: [{ id: 'tk', naam: 'Turnkey' }, { id: 'huur', naam: 'Huur' }] } },
    ])
    expect(MENSEN.pm).toBe(pm)
    expect(MENSEN.pm).toEqual(['Anna', 'Bart'])
    expect(MENSEN.am).toEqual(standaard().mensen.rollen.am)
    expect(EIGENAREN).toEqual(['Anna'])
    expect(statusNaam('niet_gestart')).toBe('Nog niet begonnen')
    expect(STATUSSEN.find(s => s.id === 'loopt')!.naam).toBe('Loopt')
    expect(faseInfo('lead')).toMatchObject({ naam: 'Kans', wat: 'Kans in beeld', rol: 'am' })
    expect(SOORTEN.map(s => s.id)).toEqual(['tk', 'huur'])
    pasToe([])
    expect(MENSEN.pm).toEqual(standaard().mensen.rollen.pm)
    expect(FASEN[0]!.naam).toBe('Lead')
  })

  it('maakt namen schoon: getrimd, zonder dubbele en lege', () => {
    const m = lees('mensen', { rollen: { am: ['  Jan  de Vries ', 'jan de vries', '', 3, 'Piet'] }, eigenaren: 'geen lijst' })
    expect(m.rollen.am).toEqual(['Jan de Vries', 'Piet'])
    expect(m.eigenaren).toEqual(standaard().mensen.eigenaren)
  })

  it('valt terug op de standaard bij een rij die niet klopt', () => {
    expect(lees('labels', 'kapot')).toEqual(standaard().labels)
    expect(lees('takenpakket', { lead: 'geen lijst' }).lead).toEqual(standaard().takenpakket.lead)
    const l = lees('labels', { disciplines: [{ id: 'Met Hoofdletter', naam: 'x' }, { id: 'dak', naam: ' Dak ' }, { id: 'dak', naam: 'Dubbel' }] })
    expect(l.disciplines).toEqual([{ id: 'dak', naam: 'Dak' }])
  })

  it('past het takenpakket en de overdracht aan, met deadlineregels', () => {
    pasToe([
      { sleutel: 'takenpakket', waarde: { haalbaarheid: [{ titel: 'Overdracht', taken: [
        { sleutel: 'scope', titel: 'Duidelijke scope', regel: { type: 'voorbereiding', dagen: 7 } },
        { sleutel: 'bodem', titel: 'Bodemonderzoek', regel: { type: 'inkoop', weken: 3, casco: true } },
        { sleutel: 'scope', titel: 'Dubbel' },
        { sleutel: 'raar', titel: 'Verkeerde regel', regel: { type: 'ooit', dagen: 3 } },
      ] }] } },
      { sleutel: 'overdracht', waarde: { haalbaarheid: { kop: 'Klaar voor ontwikkeling', items: [{ titel: 'Scope', taken: ['haalbaarheid:scope', 'iets:anders', 'haalbaarheid:scope'] }] } } },
    ])
    expect(LIJSTEN.haalbaarheid).toHaveLength(1)
    expect(LIJSTEN.haalbaarheid[0]!.taken.map(t => t.sleutel)).toEqual(['scope', 'bodem', 'raar'])
    expect(vindStandaardtaak('haalbaarheid', 'scope')!.regel).toEqual({ type: 'voorbereiding', dagen: 7 })
    expect(vindStandaardtaak('haalbaarheid', 'bodem')!.regel).toEqual({ type: 'inkoop', weken: 3, casco: true })
    expect(vindStandaardtaak('haalbaarheid', 'raar')!.regel).toBeUndefined()
    expect(EISEN.haalbaarheid).toEqual({ kop: 'Klaar voor ontwikkeling', items: [{ titel: 'Scope', taken: ['haalbaarheid:scope'] }] })
    // De stand van een eis rekent met de nieuwe deadline: 7 dagen vóór start voorbereiding.
    const p = { datum_casco: null, datum_voorbereiding: '2026-10-20', datum_inkoop: null, datum_afbouw: null, datum_oplevering: null }
    expect(eisStand(['haalbaarheid:scope'], p, [], new Date(2026, 9, 14))).toBe('telaat')
    expect(LIJSTEN.ontwikkeling).toEqual(standaard().takenpakket.ontwikkeling)
  })

  it('maakt een nieuwe code uit een naam, uniek', () => {
    expect(nieuweCode('Brandveiligheid & Advies', [])).toBe('brandveiligheid_advies')
    expect(nieuweCode('Dak', ['dak', 'dak_2'])).toBe('dak_3')
    expect(nieuweCode('Één', [])).toBe('een')
    expect(nieuweCode('!!!', [])).toBe('item')
  })
})

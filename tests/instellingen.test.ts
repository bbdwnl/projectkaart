import { afterEach, describe, expect, it } from 'vitest'
import { EIGENAREN, EISEN, FASEN, MENSEN, SOORTEN, faseInfo } from '~/lib/fasen'
import { huidig, lees, nieuweCode, pasToe, standaard, vervallenNa } from '~/lib/instellingen'
import { groepenVoor, LIJSTEN, vindStandaardtaak } from '~/lib/taken'
import { STATUSSEN, statusNaam } from '~/lib/taak'
import { eisStand, takenVan } from '~/lib/stoplicht'

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

  it('geeft elke fase een kleur, alleen als hij volgens de regels is', () => {
    const s = standaard().labels.fasen
    expect(s.uitvoering.kleur).toBe('#4caf50')
    expect(s.nazorg.kleur).toBe('#e53935')
    const l = lees('labels', { fasen: {
      uitvoering: { kleur: '#1f7a45' },
      nazorg: { kleur: 'rood' },
      lead: { kleur: '#abc' },
    } })
    expect(l.fasen.uitvoering.kleur).toBe('#1f7a45')
    expect(l.fasen.nazorg.kleur).toBe(s.nazorg.kleur)
    expect(l.fasen.lead.kleur).toBe(s.lead.kleur)
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

  it('houdt een taak die uit het pakket gaat op de projecten die er al waren (beslissing 41)', () => {
    const oud = standaard().takenpakket
    const nieuw = standaard().takenpakket
    nieuw.nazorg[0]!.taken = nieuw.nazorg[0]!.taken.filter(t => t.sleutel !== 'opleverpunten')
    nieuw.lead = []
    const weg = vervallenNa(oud, nieuw, standaard().vervallen, '2026-10-31T10:00:00.000Z')
    expect(weg.nazorg).toEqual([{ sleutel: 'opleverpunten', titel: 'Opleverpunten opgelost', regel: { type: 'oplevering', dagen: 21 }, groep: 'Nazorg', weg: '2026-10-31T10:00:00.000Z' }])
    expect(weg.lead.map(v => [v.sleutel, v.groep])).toEqual([['betaalde_opdracht', 'Overdracht naar haalbaarheid'], ['risico', 'Overdracht naar haalbaarheid']])
    expect(weg.uitvoering).toEqual([])
    pasToe([{ sleutel: 'takenpakket', waarde: nieuw }, { sleutel: 'vervallen', waarde: weg }])

    const datums = { datum_casco: null, datum_voorbereiding: null, datum_inkoop: null, datum_afbouw: null, datum_oplevering: '2026-10-01' }
    const ouder = { ...datums, aangemaakt_op: '2026-10-07T09:00:00+00:00' }
    const nieuwer = { ...datums, aangemaakt_op: '2026-11-02T09:00:00+00:00' }
    // Een project van vóór het weghalen houdt de taak, op zijn plek in de groep en met zijn deadline; een nieuwer niet.
    expect(takenVan('nazorg', ouder, [], [], new Date(2026, 9, 31)).map(r => [r.titel, r.b.licht])).toEqual([
      ['Financiële afhandeling', 'letop'], ['Opleverpunten opgelost', 'telaat'],
    ])
    expect(takenVan('nazorg', nieuwer, [], [], new Date(2026, 9, 31)).map(r => r.titel)).toEqual(['Financiële afhandeling'])
    expect(takenVan('nazorg', datums, [], [], new Date(2026, 9, 31)).map(r => r.titel)).toEqual(['Financiële afhandeling'])
    // Een groep die helemaal weg is, komt op een oud project terug als eigen groep.
    expect(groepenVoor('lead', ouder.aangemaakt_op)).toEqual([{ titel: 'Overdracht naar haalbaarheid', taken: [
      { sleutel: 'betaalde_opdracht', titel: 'Betaalde opdracht' }, { sleutel: 'risico', titel: 'Analyse risico\'s & kansen' },
    ] }])
    expect(groepenVoor('lead', nieuwer.aangemaakt_op)).toEqual([])
    expect(eisStand(['nazorg:opleverpunten'], ouder, [], new Date(2026, 9, 31))).toBe('telaat')
    expect(vindStandaardtaak('nazorg', 'opleverpunten')!.titel).toBe('Opleverpunten opgelost')

    // Terug in het pakket: weer voor iedereen, en niet meer bij wat eruit ging. Later weer weg: vanaf dat moment.
    const terug = vervallenNa(nieuw, oud, weg, '2026-11-05T10:00:00.000Z')
    expect(terug.nazorg).toEqual([])
    expect(terug.lead).toEqual([])
    const weer = vervallenNa(oud, nieuw, terug, '2026-11-09T10:00:00.000Z')
    expect(weer.nazorg.map(v => v.weg)).toEqual(['2026-11-09T10:00:00.000Z'])
  })

  it('leest de lijst met vervallen taken streng: wat niet klopt, valt weg', () => {
    const l = lees('vervallen', { nazorg: [
      { sleutel: 'goed', titel: 'Goed', groep: 'Nazorg', weg: '2026-10-31T10:00:00Z', regel: { type: 'oplevering', dagen: 7 } },
      { sleutel: 'goed', titel: 'Dubbel', groep: 'Nazorg', weg: '2026-10-31T10:00:00Z' },
      { sleutel: 'zonder_moment', titel: 'Geen moment', groep: 'Nazorg', weg: 'ooit' },
      { sleutel: 'Fout!', titel: 'Verkeerde sleutel', groep: 'Nazorg', weg: '2026-10-31T10:00:00Z' },
      { sleutel: 'zonder_groep', titel: 'Geen groep', weg: '2026-10-31T10:00:00Z' },
    ], lead: 'geen lijst' })
    expect(l.nazorg.map(v => v.sleutel)).toEqual(['goed'])
    expect(l.nazorg[0]!.regel).toEqual({ type: 'oplevering', dagen: 7 })
    expect(l.lead).toEqual([])
  })

  it('maakt een nieuwe code uit een naam, uniek', () => {
    expect(nieuweCode('Brandveiligheid & Advies', [])).toBe('brandveiligheid_advies')
    expect(nieuweCode('Dak', ['dak', 'dak_2'])).toBe('dak_3')
    expect(nieuweCode('Één', [])).toBe('een')
    expect(nieuweCode('!!!', [])).toBe('item')
  })
})

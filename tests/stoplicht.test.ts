import { describe, expect, it } from 'vitest'
import { beoordeel, deadlineVan, eisStand, opUrgentie, samen, standZin, takenVan, telling, volgendeMijlpaal } from '~/lib/stoplicht'
import { fmt, naarDatum } from '~/lib/datum'
import type { ProjectDatums, Taak } from '~/lib/types'

const NU = new Date(2026, 9, 7) // 07-10-2026
// Apeldoorn Vlijtseweg (P20038), datums uit het prototype
const P: ProjectDatums = {
  datum_casco: null,
  datum_voorbereiding: '2026-08-11',
  datum_inkoop: '2026-10-20',
  datum_afbouw: '2026-12-01',
  datum_oplevering: '2027-04-01',
}
const d = (iso: string) => naarDatum(iso)!

function taak(extra: Partial<Taak>): Taak {
  return {
    id: 't' + Math.random(), project_id: 'p1', lijst: null, sleutel: null, uitzondering_id: null, fase: 'ontwikkeling',
    deadline: null, status: 'niet_gestart', eigenaar: null, notitie: null, reden_nvt: null, aanleiding: null,
    klantakkoord: false, klantakkoord_door: null, klantakkoord_op: null, document_url: null, document_naam: null,
    afgetekend_door: null, afgetekend_op: null, gewijzigd_op: null, gewijzigd_door: null, ...extra,
  }
}

describe('deadlineVan', () => {
  it('rekent ontwikkelstukken terug vanaf inkoop gereed', () => {
    expect(fmt(deadlineVan({ type: 'inkoop', weken: 1 }, P))).toBe('13-10-2026')
    expect(fmt(deadlineVan({ type: 'inkoop', weken: 0 }, P))).toBe('20-10-2026')
  })
  it('valt nooit vóór start voorbereiding', () => {
    expect(fmt(deadlineVan({ type: 'inkoop', weken: 9 }, P))).toBe('18-08-2026')
    expect(fmt(deadlineVan({ type: 'inkoop', weken: 20 }, P))).toBe('11-08-2026')
  })
  it('rekent cascostukken vanaf start casco als die tussen voorbereiding en inkoop valt', () => {
    const metCasco = { ...P, datum_casco: '2026-09-29' }
    expect(fmt(deadlineVan({ type: 'inkoop', weken: 1, casco: true }, metCasco))).toBe('22-09-2026')
    expect(fmt(deadlineVan({ type: 'inkoop', weken: 1, casco: false }, metCasco))).toBe('13-10-2026')
    // casco na inkoop: dan gewoon vanaf inkoop
    expect(fmt(deadlineVan({ type: 'inkoop', weken: 1, casco: true }, { ...P, datum_casco: '2026-11-01' }))).toBe('13-10-2026')
  })
  it('rekent haalbaarheid vanaf voorbereiding en nazorg vanaf oplevering', () => {
    expect(fmt(deadlineVan({ type: 'voorbereiding', dagen: 14 }, P))).toBe('28-07-2026')
    expect(fmt(deadlineVan({ type: 'oplevering', dagen: 21 }, P))).toBe('22-04-2027')
    expect(fmt(deadlineVan({ type: 'afbouw', dagen: 0 }, P))).toBe('01-12-2026')
  })
  it('geeft null zonder datum of regel', () => {
    expect(deadlineVan(undefined, P)).toBeNull()
    expect(deadlineVan({ type: 'inkoop', weken: 1 }, { ...P, datum_inkoop: null })).toBeNull()
  })
})

describe('beoordeel', () => {
  it('groen alleen met document', () => {
    expect(beoordeel(d('2026-01-01'), taak({ status: 'definitief', document_naam: 'x.pdf' }), NU).licht).toBe('klaar')
    expect(beoordeel(d('2026-01-01'), taak({ status: 'definitief' }), NU)).toMatchObject({ licht: 'letop', reden: 'Definitief, maar nog geen document' })
  })
  it('n.v.t. vraagt een reden', () => {
    expect(beoordeel(null, taak({ status: 'nvt', reden_nvt: 'Nieuwbouw' }), NU)).toMatchObject({ licht: 'later', woord: 'N.v.t.' })
    expect(beoordeel(null, taak({ status: 'nvt' }), NU).licht).toBe('letop')
    expect(beoordeel(null, taak({ status: 'volgende_fase' }), NU).licht).toBe('later')
  })
  it('kleurt op de deadline', () => {
    expect(beoordeel(d('2026-10-06'), taak({ status: 'loopt' }), NU)).toMatchObject({ licht: 'telaat', reden: '1 dag te laat' })
    expect(beoordeel(d('2026-10-07'), undefined, NU)).toMatchObject({ licht: 'letop', reden: 'Vandaag' })
    expect(beoordeel(d('2026-10-21'), undefined, NU)).toMatchObject({ licht: 'letop', reden: 'Nog 14 dagen' })
    expect(beoordeel(d('2026-10-22'), undefined, NU)).toMatchObject({ licht: 'open', reden: 'Nog 15 dagen' })
    expect(beoordeel(null, undefined, NU)).toMatchObject({ licht: 'open', reden: 'Geen deadline' })
  })
})

describe('samen', () => {
  it('neemt het ergste licht en laat n.v.t. weg', () => {
    expect(samen(['klaar', 'telaat', 'letop'])).toBe('telaat')
    expect(samen(['klaar', 'later'])).toBe('klaar')
    expect(samen(['later'])).toBe('later')
    expect(samen(['klaar', 'open'])).toBe('open')
  })
})

describe('takenVan en de standzin', () => {
  const uitz = { id: 'u1', titel: 'Extra bodemonderzoek (PFAS)', fase: 'ontwikkeling' as const, status: 'uitzondering' as const, aangemaakt_op: null }
  const taken = [
    taak({ lijst: 'ontwikkeling', sleutel: 'demarcatie', status: 'definitief', document_naam: 'a.pdf' }),
    taak({ lijst: 'ontwikkeling', sleutel: 'sloopplan', status: 'nvt', reden_nvt: 'Nieuwbouw' }),
    taak({ uitzondering_id: 'u1', fase: 'ontwikkeling', deadline: '2026-10-15', status: 'loopt' }),
  ]
  const regels = takenVan('ontwikkeling', P, taken, [uitz], NU)

  it('geeft alle standaardtaken plus de uitzonderingen van de fase', () => {
    expect(regels).toHaveLength(29)
    expect(regels.at(-1)).toMatchObject({ titel: 'Extra bodemonderzoek (PFAS)', groep: 'Uitzonderingen in dit project' })
    expect(regels.find(r => r.id === 'std:ontwikkeling:demarcatie')?.b.licht).toBe('klaar')
  })
  it('telt per licht', () => {
    const t = telling(regels)
    expect(t.klaar).toBe(1)
    expect(t.later).toBe(1)
    expect(t.telaat + t.letop + t.open + t.klaar + t.later).toBe(29)
  })
  it('zet het dringendste bovenaan', () => {
    const lichten = opUrgentie(regels).map(r => r.b.licht)
    expect(lichten[0]).toBe('telaat')
    expect(lichten.at(-1)).toBe('later')
  })
  it('maakt een zin die het praten doet', () => {
    const zin = standZin({ fase: 'ontwikkeling', ...P }, regels).map(z => z.tekst).join('')
    expect(zin).toMatch(/^\d+ taken te laat en \d+ vragen aandacht voor inkoop gereed op 20-10-2026\.$/)
    const klaar = standZin({ fase: 'ontwikkeling', ...P }, [{ b: beoordeel(null, taak({ status: 'definitief', document_naam: 'x' }), NU) }])
    expect(klaar.map(z => z.tekst).join('')).toBe('Alles voor inkoop gereed op 20-10-2026 is klaar.')
    const open = standZin({ fase: 'uitvoering', ...P }, [{ b: beoordeel(null, undefined, NU) }])
    expect(open.map(z => z.tekst).join('')).toBe('1 taak open voor start afbouw op 01-12-2026.')
  })
})

describe('eisStand en mijlpaal', () => {
  it('leidt een overdrachtseis af uit de gekoppelde taken', () => {
    const taken = [
      taak({ lijst: 'ontwikkeling', sleutel: 'do_casco', status: 'definitief', document_naam: 'a' }),
      taak({ lijst: 'ontwikkeling', sleutel: 'do_installaties', status: 'concept' }),
    ]
    expect(eisStand(['ontwikkeling:do_casco'], P, taken, NU)).toBe('klaar')
    expect(eisStand(['ontwikkeling:do_casco', 'ontwikkeling:do_installaties'], P, taken, NU)).toBe('telaat')
  })
  it('telt af naar de mijlpaal van de fase', () => {
    expect(volgendeMijlpaal({ fase: 'ontwikkeling', ...P }, NU)).toMatchObject({ naam: 'inkoop gereed', dagen: 13 })
    expect(volgendeMijlpaal({ fase: 'lead', ...P }, NU)).toBeNull()
  })
})

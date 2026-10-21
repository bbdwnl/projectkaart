import { describe, expect, it } from 'vitest'
import { actiehouders, alsTekst, herinnering, mailLink, openActies } from '~/lib/actiemail'
import type { Actie } from '~/lib/types'

const nu = new Date(2026, 9, 20)
const actie = (id: string, project_id: string, extra: Partial<Actie>): Actie => ({
  id, project_id, tekst: 'Iets doen', actiehouder: 'Carlo', deadline: null, gereed: false, gereed_door: null, gereed_op: null,
  aangemaakt_door: 'Michiel', aangemaakt_op: `2026-10-0${id.length}T09:00:00Z`, ...extra,
})
const projecten = [{ id: 'p1', naam: 'Rozenburg', slug: 'rozenburg' }, { id: 'p2', naam: 'Sneek', slug: 'sneek' }]

describe('mail aan actiehouders', () => {
  const acties = [
    actie('a', 'p1', { tekst: 'Kozijnmaten controleren', deadline: '2026-10-10' }),
    actie('bb', 'p1', { tekst: 'Sluitplan afstemmen', gereed: true }),
    actie('ccc', 'p2', { tekst: 'Schouw plannen', deadline: '2026-11-01' }),
    actie('dddd', 'p2', { tekst: '   ' }),
    actie('eeeee', 'p2', { tekst: 'Offerte beoordelen', actiehouder: 'Architect' }),
  ]
  const h = actiehouders(acties, projecten, nu)

  it('telt per actiehouder de open acties met tekst, genummerd zoals op de kaart', () => {
    expect(h.map(x => [x.naam, x.acties.map(a => `${a.p.naam} ${a.nr}`), x.teLaat])).toEqual([
      ['Architect', ['Sneek 3'], 0],
      ['Carlo', ['Rozenburg 1', 'Sneek 1'], 1],
    ])
  })

  it('maakt een herinnering en een mail met de acties, met een link naar de actielijst', () => {
    const carlo = h.find(x => x.naam === 'Carlo')!
    const m = openActies(carlo, 'carlo@bbdw.nl', 'Michiel', 'https://kaart.bbdw.nl', nu)
    expect(m.onderwerp).toBe('Je open acties uit het overleg (2)')
    expect(m.tekst).toContain('  1. Kozijnmaten controleren (deadline 10-10-2026, te laat)')
    expect(m.tekst).toContain('https://kaart.bbdw.nl/projecten/sneek#acties')
    expect(herinnering(carlo, 'carlo@bbdw.nl', 'Michiel', 'https://x', nu).tekst).toContain('2 open acties, waarvan 1 te laat')
    expect(alsTekst(m).startsWith('Aan: carlo@bbdw.nl\nOnderwerp: ')).toBe(true)
  })

  it('opent de mail in Outlook op het web of in het mailprogramma', () => {
    const m = { aan: 'a@bbdw.nl;b@bbdw.nl', onderwerp: 'Acties & meer', tekst: 'Regel 1\nRegel 2' }
    expect(mailLink(m, 'web')).toBe('https://outlook.office.com/mail/deeplink/compose?to=a%40bbdw.nl%3Bb%40bbdw.nl&subject=Acties%20%26%20meer&body=Regel%201%0ARegel%202')
    expect(mailLink(m, 'app')).toBe('mailto:a@bbdw.nl;b@bbdw.nl?subject=Acties%20%26%20meer&body=Regel%201%0ARegel%202')
  })
})

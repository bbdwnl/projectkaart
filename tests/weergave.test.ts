import { describe, expect, it } from 'vitest'
import { kolomSjabloon, leesWeergave, WEERGAVE_STANDAARD } from '~/lib/weergave'

describe('leesWeergave', () => {
  it('geeft de standaard zonder cookie', () => {
    expect(leesWeergave(undefined)).toEqual(WEERGAVE_STANDAARD)
    expect(leesWeergave('geen json')).toEqual(WEERGAVE_STANDAARD)
  })
  it('neemt bekende keuzes over, ook uit een JSON-string', () => {
    const w = leesWeergave(JSON.stringify({ tab: 'details', taken: { kolommen: { akkoord: false } } }))
    expect(w.tab).toBe('details')
    expect(w.taken.kolommen).toEqual({ eigenaar: true, deadline: true, akkoord: false, document: true })
  })
  it('negeert onbekende sleutels, verkeerde typen en een onbekend tabblad', () => {
    const w = leesWeergave({ tab: 'iets', kop: { stoplicht: 'nee', extra: true }, onzin: 1 })
    expect(w.tab).toBe('taken')
    expect(w.kop).toEqual({ stoplicht: true, planningstrook: true })
    expect('onzin' in w).toBe(false)
  })
  it('verandert de standaard niet', () => {
    leesWeergave({ kop: { stoplicht: false } })
    expect(WEERGAVE_STANDAARD.kop.stoplicht).toBe(true)
  })
})

describe('kolomSjabloon', () => {
  it('laat uitgezette kolommen weg', () => {
    const w = leesWeergave({ taken: { kolommen: { document: false, akkoord: false } } })
    expect(kolomSjabloon(w)).toBe('86px minmax(0,1fr) 104px 116px 128px 32px')
  })
})

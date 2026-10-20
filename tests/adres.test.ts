import { describe, expect, it } from 'vitest'
import { adresRegel, kiesAdres, normaalHuisnummer, normaalPostcode, type PdokAdres } from '~/lib/adres'

describe('postcode en huisnummer', () => {
  it('schrijft een postcode als 1234 AB', () => {
    expect(normaalPostcode('5222ae')).toBe('5222 AE')
    expect(normaalPostcode(' 5222  AE ')).toBe('5222 AE')
    expect(normaalPostcode('0222 AE')).toBeNull()
    expect(normaalPostcode('5222')).toBeNull()
  })

  it('schrijft een huisnummer zoals de BAG', () => {
    expect(normaalHuisnummer('8')).toBe('8')
    expect(normaalHuisnummer('8 a')).toBe('8A')
    expect(normaalHuisnummer('8a-1')).toBe('8A-1')
    expect(normaalHuisnummer('8a 1')).toBe('8A-1')
    expect(normaalHuisnummer('12 - 2')).toBe('12-2')
    expect(normaalHuisnummer('12 bis')).toBe('12-BIS')
    expect(normaalHuisnummer('kavel 4')).toBeNull()
  })
})

describe('adres kiezen', () => {
  const doc = (huis_nlt: string): PdokAdres => ({ straatnaam: 'Veemarktkade', huis_nlt, postcode: '5222AE', woonplaatsnaam: '\'s-Hertogenbosch', adresseerbaarobject_id: `bag-${huis_nlt}` })
  const docs = [doc('8'), doc('8A'), doc('8A-1')]

  it('neemt precies dit huisnummer', () => {
    expect(kiesAdres(docs, '8A')).toEqual({ stand: 'gevonden', adres: { postcode: '5222 AE', huisnummer: '8A', straat: 'Veemarktkade', plaats: '\'s-Hertogenbosch' }, bagId: 'bag-8A' })
  })

  it('noemt anders de huisnummers die er wel zijn', () => {
    expect(kiesAdres(docs, '8B')).toEqual({ stand: 'niet_gevonden', varianten: ['8', '8A', '8A-1'] })
    expect(kiesAdres([], '8')).toEqual({ stand: 'niet_gevonden', varianten: [] })
  })

  it('maakt er één regel van, ook als er delen ontbreken', () => {
    expect(adresRegel({ straat: 'Veemarktkade', huisnummer: '8', postcode: '5222 AE', plaats: '\'s-Hertogenbosch' })).toBe('Veemarktkade 8, 5222 AE \'s-Hertogenbosch')
    expect(adresRegel({ straat: 'Vlijtseweg', plaats: 'Apeldoorn' })).toBe('Vlijtseweg, Apeldoorn')
    expect(adresRegel({ straat: null, huisnummer: null, postcode: null, plaats: null })).toBeNull()
  })
})

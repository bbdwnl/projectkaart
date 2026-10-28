import { describe, expect, it } from 'vitest'
import { inlogMoment, naamUitEmail, vanDomein, veiligPad, verlooptOp } from '~/lib/inlog'

/** Een access token zoals Supabase het geeft; alleen het middelste deel telt hier. */
const token = (claims: object) => `kop.${btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.handtekening`

describe('inloggen met een link', () => {
  it('laat alleen adressen van het eigen domein toe', () => {
    expect(vanDomein('Benno@BBDW.nl ', 'bbdw.nl')).toBe(true)
    expect(vanDomein('iemand@gmail.com', 'bbdw.nl')).toBe(false)
    expect(vanDomein('iemand@nep-bbdw.nl', 'bbdw.nl')).toBe(false)
    expect(vanDomein('iemand@bbdw.nl@gmail.com', 'bbdw.nl')).toBe(false)
    expect(vanDomein('@bbdw.nl', 'bbdw.nl')).toBe(false)
  })

  it('leest het moment van inloggen uit het token, en een inlog geldt daarna een week', () => {
    const moment = inlogMoment(token({ email: 'benno@bbdw.nl', amr: [{ method: 'otp', timestamp: 1_793_000_000 }] }))
    expect(moment).toEqual(new Date(1_793_000_000_000))
    expect(verlooptOp(moment!).getTime() - moment!.getTime()).toBe(7 * 24 * 3600 * 1000)
    expect(inlogMoment(token({ amr: [{ method: 'otp', timestamp: 200 }, { method: 'magiclink', timestamp: 100 }] }))).toEqual(new Date(100_000))
    expect(inlogMoment(token({ email: 'benno@bbdw.nl' }))).toBeNull()
    expect(inlogMoment('geen token')).toBeNull()
  })

  it('telt alleen een inlog met een link, niet met een wachtwoord', () => {
    expect(inlogMoment(token({ amr: [{ method: 'password', timestamp: 100 }] }))).toBeNull()
    expect(inlogMoment(token({ amr: [{ method: 'oauth', timestamp: 100 }] }))).toBeNull()
    expect(inlogMoment(token({ amr: [{ timestamp: 100 }] }))).toBeNull()
    for (const method of ['otp', 'magiclink', 'email/signup', 'invite']) expect(inlogMoment(token({ amr: [{ method, timestamp: 100 }] }))).toEqual(new Date(100_000))
  })

  it('stuurt na het inloggen alleen terug naar een pad binnen de app', () => {
    expect(veiligPad('/projecten/vlijtseweg?weergave=planning')).toBe('/projecten/vlijtseweg?weergave=planning')
    expect(veiligPad('//evil.example')).toBe('/')
    expect(veiligPad('/\\evil.example')).toBe('/')
    expect(veiligPad('https://evil.example')).toBe('/')
    expect(veiligPad(undefined)).toBe('/')
  })

  it('stelt een naam voor uit het adres', () => {
    expect(naamUitEmail('benno@bbdw.nl')).toBe('Benno')
    expect(naamUitEmail('jan.de.vries@bbdw.nl')).toBe('Jan de Vries')
    expect(naamUitEmail('b.van.bergen@bbdw.nl')).toBe('B. van Bergen')
    expect(naamUitEmail('MICHIEL_JANSEN@bbdw.nl')).toBe('Michiel Jansen')
  })
})

import { describe, expect, it } from 'vitest'
import { FOUT_ADRES, GEEN_POGINGEN, inlogMoment, leesPogingen, naamUitEmail, naFoutAdres, vanDomein, veiligPad, verlooptOp } from '~/lib/inlog'

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

  it('zegt bij een fout adres niet welk domein wel mag', () => {
    expect(FOUT_ADRES).toBe('Foutief of onbekend e-mailadres.')
    expect(FOUT_ADRES).not.toMatch(/bbdw/i)
  })

  it('zet het adresveld na vijf foute adressen op rij vijf minuten dicht, en telt daarna opnieuw', () => {
    const nu = 1_000_000
    let p = GEEN_POGINGEN
    for (let i = 1; i <= 4; i++) {
      p = naFoutAdres(p, nu)
      expect(p).toEqual({ fout: i, tot: 0 })
    }
    p = naFoutAdres(p, nu)
    expect(p).toEqual({ fout: 0, tot: nu + 5 * 60_000 })
    expect(naFoutAdres(p, nu + 6 * 60_000)).toEqual({ fout: 1, tot: nu + 5 * 60_000 })
  })

  it('leest de bewaarde pogingen, en iets anders als geen', () => {
    expect(leesPogingen(JSON.stringify({ fout: 3, tot: 42 }))).toEqual({ fout: 3, tot: 42 })
    expect(leesPogingen(null)).toEqual(GEEN_POGINGEN)
    expect(leesPogingen('{"fout":"x"}')).toEqual(GEEN_POGINGEN)
    expect(leesPogingen('kapot')).toEqual(GEEN_POGINGEN)
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

// Inloggen met een link per mail: alleen adressen van het eigen domein, en een inlog geldt een week.
// De database dwingt hetzelfde af (toegestane_domeinen() en inlogduur() in de migraties); dit is voor het scherm.

/** Zo lang geldt een inlog, vanaf het moment van inloggen. Gebruik verlengt hem niet. Gelijk aan inlogduur() in SQL. */
export const INLOGDUUR_DAGEN = 7

/**
 * Inloggen met een link per mail, zoals Supabase het in amr zet: otp (onze mail met token_hash), magiclink en
 * email/signup (de standaardmail), invite. Niet password: zie is_medewerker() in de migratie alleen_inloglink.
 */
export const INLOG_METHODEN = ['otp', 'magiclink', 'email/signup', 'invite']

/** Is dit een adres op dit domein? Hoofdletters en spaties tellen niet. */
export function vanDomein(email: string, domein: string): boolean {
  const [naam, achter, ...rest] = email.trim().toLowerCase().split('@')
  return !!naam && !rest.length && achter === domein.toLowerCase()
}

/**
 * Wanneer deze sessie begon met een link per mail: de claim amr in het access token van Supabase. Die houdt het
 * moment van inloggen vast; een ververst token krijgt hetzelfde moment mee. Null als het token dat niet zegt, of als
 * er anders is ingelogd (met een wachtwoord): dat geeft geen toegang, net als in is_medewerker().
 */
export function inlogMoment(accessToken: string): Date | null {
  try {
    const deel = accessToken.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const amr = JSON.parse(atob(deel)).amr as { method?: unknown, timestamp?: unknown }[] | undefined
    const momenten = (Array.isArray(amr) ? amr : [])
      .filter(a => typeof a.method === 'string' && INLOG_METHODEN.includes(a.method))
      .map(a => a.timestamp).filter((t): t is number => typeof t === 'number')
    return momenten.length ? new Date(Math.min(...momenten) * 1000) : null
  } catch {
    return null
  }
}

/** Tot wanneer een inlog van dit moment geldt. */
export const verlooptOp = (moment: Date) => new Date(moment.getTime() + INLOGDUUR_DAGEN * 24 * 3600 * 1000)

/** De melding bij een adres dat niet mag: hij zegt niet welk domein wel mag. */
export const FOUT_ADRES = 'Foutief of onbekend e-mailadres.'

/** Na zoveel foute adressen op rij gaat het adresveld dicht, zonder melding. */
export const MAX_FOUTE_ADRESSEN = 5
export const BLOKKADE_MINUTEN = 5

/** Hoeveel foute adressen er op rij waren, en tot wanneer het veld dicht is (ms sinds 1970, 0 = open). */
export interface Pogingen { fout: number, tot: number }
export const GEEN_POGINGEN: Pogingen = { fout: 0, tot: 0 }

/** Een fout adres erbij. Bij de vijfde op rij: dicht voor vijf minuten, en daarna begint de telling opnieuw. */
export function naFoutAdres(p: Pogingen, nu: number): Pogingen {
  const fout = p.fout + 1
  return fout >= MAX_FOUTE_ADRESSEN ? { fout: 0, tot: nu + BLOKKADE_MINUTEN * 60_000 } : { fout, tot: p.tot }
}

/** Wat er bewaard stond; iets dat er niet uitziet als pogingen telt als geen. */
export function leesPogingen(tekst: string | null): Pogingen {
  try {
    const p = JSON.parse(tekst ?? '') as Partial<Pogingen>
    return Number.isFinite(p.fout) && Number.isFinite(p.tot) ? { fout: p.fout!, tot: p.tot! } : GEEN_POGINGEN
  } catch {
    return GEEN_POGINGEN
  }
}

/** Alleen een pad binnen de app, zodat een link je niet naar een andere site kan sturen. */
export const veiligPad = (pad: unknown) => (typeof pad === 'string' && pad.startsWith('/') && !pad.startsWith('//') && !pad.startsWith('/\\') ? pad : '/')

const TUSSENVOEGSELS = new Set(['van', 'de', 'der', 'den', 'het', 'ter', 'ten', 'te', 'in', 'op', 'v', 'vd'])

/** Een eerste voorstel voor iemands naam, uit het adres: jan.de.vries@ wordt Jan de Vries. Je past hem zelf aan. */
export function naamUitEmail(email: string): string {
  const delen = email.split('@')[0]!.split(/[._-]+/).filter(Boolean)
  return delen.map((d, i) => (i > 0 && i < delen.length - 1 && TUSSENVOEGSELS.has(d.toLowerCase())
    ? d.toLowerCase()
    : d[0]!.toUpperCase() + d.slice(1).toLowerCase() + (d.length === 1 ? '.' : ''))).join(' ')
}

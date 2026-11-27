import type { EmailOtpType, Session, SupabaseClient } from '@supabase/supabase-js'
import type { Gebruiker } from '~/lib/types'
import { ACTIEF_MINUTEN, FOUT_ADRES, GEEN_POGINGEN, inlogMoment, leesPogingen, naamUitEmail, naFoutAdres, vanDomein, veiligPad, verlooptOp, type Pogingen } from '~/lib/inlog'

/** Waar je was toen je de inloglink aanvroeg; de link zelf brengt je naar /login. */
const TERUG_SLEUTEL = 'projectkaart_terug'
/** De foute adressen op rij en de blokkade, zodat herladen het veld niet weer opent. */
const POGINGEN_SLEUTEL = 'projectkaart_inlogpogingen'
/** Als de browser niets mag bewaren (privévenster): alleen in het geheugen. */
let pogingenNu: Pogingen = GEEN_POGINGEN

function leesBewaard(): Pogingen {
  try { pogingenNu = leesPogingen(localStorage.getItem(POGINGEN_SLEUTEL)) } catch { /* dan wat er in het geheugen staat */ }
  return pogingenNu
}
function bewaar(p: Pogingen) {
  pogingenNu = p
  try { localStorage.setItem(POGINGEN_SLEUTEL, JSON.stringify(p)) } catch { /* dan alleen in het geheugen */ }
}

// Eén Supabase-client en één domein per app, gezet door de plugin.
let sb: SupabaseClient | null = null
let domein = ''
let verloopKlok: ReturnType<typeof setTimeout> | undefined
/** Wanneer de app voor het laatst aan de database meldde dat hij gebruikt wordt (ms). */
let laatstGemeld = 0

/**
 * Meldt de database dat deze sessie gebruikt wordt (ik_ben_actief): zo verlengt gebruik de inlog. Hoogstens elk kwartier,
 * tenzij nu. Geeft terug tot wanneer de inlog geldt zonder verder gebruik (ms), null als hij al verlopen is, of
 * undefined als er niets gemeld is (te kort geleden, of de database antwoordde niet).
 */
async function meldActief(nu = false): Promise<number | null | undefined> {
  if (!sb || (!nu && Date.now() - laatstGemeld < ACTIEF_MINUTEN * 60_000)) return undefined
  laatstGemeld = Date.now()
  const { data, error } = await sb.rpc('ik_ben_actief')
  if (error) return undefined
  return typeof data === 'string' ? Date.parse(data) : null
}

export function useGebruiker() {
  const gebruiker = useState<Gebruiker | null>('gebruiker', () => null)
  const melding = useState('inlogmelding', () => '')
  /** Tot wanneer het adresveld dicht is na vijf foute adressen op rij (ms; 0 = open). Het scherm zegt het niet. */
  const geblokkeerdTot = useState('inlogblokkade', () => leesBewaard().tot)
  const router = useRouter()

  /** Uitloggen zodra de inlog zonder verder gebruik verloopt (de database laat je dan ook niet meer toe). */
  function zetKlok(tot: number) {
    clearTimeout(verloopKlok)
    verloopKlok = setTimeout(() => verlopen(true), Math.max(0, Math.min(tot - Date.now(), 2 ** 31 - 1)))
  }

  /** Bij gebruik (een andere pagina, terug in dit tabblad): de database verlengt de inlog, en de klok schuift mee. */
  async function actief() {
    if (!gebruiker.value) return
    const tot = await meldActief()
    if (tot === null) await verlopen(true)
    else if (tot !== undefined) zetKlok(tot)
  }

  /** Wie bij deze sessie hoort. Een ander domein, of 30 dagen niet gebruikt: uitloggen. */
  async function zet(sessie: Session | null) {
    clearTimeout(verloopKlok)
    if (!sessie || !sb) {
      gebruiker.value = null
      return
    }
    const email = sessie.user.email ?? ''
    if (!vanDomein(email, domein)) {
      melding.value = 'Dit account heeft geen toegang.'
      gebruiker.value = null
      await sb.auth.signOut({ scope: 'local' })
      return
    }
    // Alleen een inlog met een link of code telt (amr), en de database zegt of hij nog geldt; die verlengt hem meteen.
    const moment = inlogMoment(sessie.access_token)
    if (!moment) return verlopen(false)
    const gemeld = await meldActief(true)
    if (gemeld === null) return verlopen(false)
    // Antwoordde de database niet, dan rekent het scherm vanaf het inloggen; de database blijft de baas.
    const tot = gemeld ?? verlooptOp(moment).getTime()
    if (tot <= Date.now()) return verlopen(false)
    zetKlok(tot)
    // Alleen de naam uit het profiel, zoals wie() in de database; die in het token kan iedereen zelf zetten.
    const { data } = await sb.from('profielen').select('rol, naam').eq('id', sessie.user.id).maybeSingle()
    const naam = data?.naam?.trim() || ''
    gebruiker.value = { naam: naam || email, email, isMt: data?.rol === 'mt', naamNodig: !naam }
  }

  /** Alleen op dit apparaat uitloggen: een nieuwere inlog op je telefoon blijft staan. Bij het opstarten stuurt de middleware je naar /login. */
  async function verlopen(naarLogin: boolean) {
    clearTimeout(verloopKlok)
    melding.value = 'Je hebt de Projectkaart 30 dagen niet gebruikt, dus je inlog is verlopen. Vraag een nieuwe inloglink aan.'
    gebruiker.value = null
    await sb?.auth.signOut({ scope: 'local' })
    const nu = router.currentRoute.value
    if (naarLogin && nu.path !== '/login') await router.push({ path: '/login', query: { terug: nu.fullPath } })
  }

  /** Eenmalig vanuit de plugin. */
  async function start(client: SupabaseClient, emailDomein: string) {
    sb = client
    domein = emailDomein
    const { data } = await sb.auth.getSession()
    await zet(data.session)
    // Geen Supabase-aanroep direct in deze callback (die kan blokkeren): eerst een tik wachten.
    sb.auth.onAuthStateChange((gebeurtenis, sessie) => {
      if (gebeurtenis === 'SIGNED_IN' || gebeurtenis === 'SIGNED_OUT') setTimeout(() => zet(sessie))
    })
    // Gebruik verlengt de inlog: bij elke andere pagina en als je terugkomt in dit tabblad (hoogstens elk kwartier).
    router.afterEach(() => { actief() })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') actief()
    })
  }

  /**
   * Stuurt een inloglink naar dit adres. Alleen het eigen domein; de database weigert de rest ook. De melding zegt
   * niet welk domein wel mag. Na vijf foute adressen op rij gaat het veld vijf minuten dicht, zonder melding.
   */
  async function stuurLink(email: string, terug = '/'): Promise<boolean> {
    if (leesBewaard().tot > Date.now()) return false
    melding.value = ''
    const adres = email.trim().toLowerCase()
    if (!vanDomein(adres, domein)) {
      melding.value = FOUT_ADRES
      const p = naFoutAdres(pogingenNu, Date.now())
      bewaar(p)
      geblokkeerdTot.value = p.tot
      return false
    }
    if (!sb) return false
    try { localStorage.setItem(TERUG_SLEUTEL, veiligPad(terug)) } catch { /* dan na het inloggen naar het begin */ }
    const { error } = await sb.auth.signInWithOtp({ email: adres, options: { emailRedirectTo: `${location.origin}/login` } })
    if (error) {
      melding.value = error.status === 429
        ? 'Er is net al een link gestuurd. Wacht een minuut en probeer het dan opnieuw.'
        : 'Versturen lukte niet. Probeer het later opnieuw.'
      return false
    }
    bewaar(GEEN_POGINGEN)
    geblokkeerdTot.value = 0
    return true
  }

  /**
   * Alleen op localhost in een dev-opstart: inloggen zonder de link per mail. De serverroute /api/dev-inlog
   * (die zélf alleen op localhost in dev antwoordt) haalt een echt magisch token op en hiermee ingelogd.
   * Doe niets buiten die omstandigheden (of als het niet lukte): dan doet de gewone weg het werk.
   */
  async function devInloggen(email: string, terug = '/'): Promise<boolean> {
    if (import.meta.dev !== true || !sb || !['localhost', '127.0.0.1'].includes(location.hostname)) return false
    melding.value = ''
    const adres = email.trim().toLowerCase()
    if (!vanDomein(adres, domein)) return false
    try { localStorage.setItem(TERUG_SLEUTEL, veiligPad(terug)) } catch { /* dan na het inloggen naar het begin */ }
    const poging = await $fetch<{ token: string }>('/api/dev-inlog', { method: 'POST', body: { email: adres } }).catch(() => null)
    if (!poging?.token) {
      melding.value = 'Dev-inloggen lukte niet. Gaat het om nog wat anders, dan komt de inloglink per mail.'
      return false
    }
    const { data, error } = await sb.auth.verifyOtp({ email: adres, token: poging.token, type: 'email' })
    if (error || !data.session) {
      melding.value = 'Dev-inloggen lukte niet. Gaat het om nog wat anders, dan komt de inloglink per mail.'
      return false
    }
    await zet(data.session)
    if (gebruiker.value && !gebruiker.value.naamNodig) await navigateTo(terug)
    return true
  }

  /** De link uit de mail (token_hash): inloggen in deze browser. Geeft terug of het lukte. */
  async function metLink(tokenHash: string, type: EmailOtpType = 'email'): Promise<boolean> {
    melding.value = ''
    if (!sb) return false
    const { data, error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error || !data.session) {
      melding.value = 'Deze inloglink werkt niet meer: hij is al gebruikt of verlopen. Vraag hieronder een nieuwe aan.'
      return false
    }
    await zet(data.session)
    return !!gebruiker.value
  }

  /**
   * De code uit dezelfde mail: inloggen in dít venster, ook als de link in een andere browser opengaat (bijvoorbeeld
   * het inlogvenster van Copilot in Outlook of Teams). Even goed als de link: amr otp, geldig zolang je de app gebruikt.
   */
  async function metCode(email: string, code: string): Promise<boolean> {
    melding.value = ''
    if (!sb) return false
    const { data, error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' })
    if (error || !data.session) {
      melding.value = error?.status === 429
        ? 'Te veel pogingen. Wacht een paar minuten, of vraag een nieuwe link aan.'
        : 'Deze code klopt niet of is verlopen. Kijk of je de nieuwste mail hebt.'
      return false
    }
    await zet(data.session)
    return !!gebruiker.value
  }

  /** Waar je heen gaat na het inloggen: waar je was toen je de link aanvroeg, anders het begin. */
  function terugNaInloggen(): string {
    try {
      const pad = localStorage.getItem(TERUG_SLEUTEL)
      localStorage.removeItem(TERUG_SLEUTEL)
      return veiligPad(pad)
    } catch {
      return '/'
    }
  }

  /** Je naam, voor het logboek en bij wat je aftekent. Gevraagd bij je eerste inlog; daarna alleen door een beheerder te wijzigen. */
  async function bewaarNaam(naam: string): Promise<boolean> {
    const schoon = naam.trim().replace(/\s+/g, ' ')
    if (!sb || !gebruiker.value || schoon.length < 2) return false
    const { data } = await sb.auth.getSession()
    const { data: rijen, error } = await sb.from('profielen').update({ naam: schoon }).eq('id', data.session?.user.id ?? '').select('id')
    if (!error && !rijen.length) {
      // Je naam stond al vast: de database laat hem dan staan (profielen_eigen_naam).
      melding.value = 'Je naam staat al vast. Vraag een beheerder als hij anders moet.'
      return false
    }
    if (error) {
      // 23505: een collega heeft deze naam al (naam_uniek in de migraties).
      melding.value = error.code === '23505'
        ? `${schoon} is al de naam van een collega. Zet er bijvoorbeeld je achternaam of een voorletter bij.`
        : `Opslaan lukte niet: ${error.message}`
      return false
    }
    gebruiker.value = { ...gebruiker.value, naam: schoon, naamNodig: false }
    return true
  }

  async function uitloggen() {
    clearTimeout(verloopKlok)
    await sb?.auth.signOut()
    gebruiker.value = null
    await navigateTo('/login')
  }

  /** Een eerste voorstel voor je naam, uit je e-mailadres. */
  const naamVoorstel = computed(() => (gebruiker.value?.email ? naamUitEmail(gebruiker.value.email) : ''))

  const initialen = computed(() => (gebruiker.value?.naam ?? '')
    .split(/[\s.@]+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join(''))

  return { gebruiker, melding, geblokkeerdTot, start, stuurLink, devInloggen, metLink, metCode, terugNaInloggen, bewaarNaam, naamVoorstel, uitloggen, initialen }
}

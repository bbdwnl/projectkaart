import type { EmailOtpType, Session, SupabaseClient } from '@supabase/supabase-js'
import type { Gebruiker } from '~/lib/types'
import { inlogMoment, naamUitEmail, vanDomein, veiligPad, verlooptOp } from '~/lib/inlog'

/** Waar je was toen je de inloglink aanvroeg; de link zelf brengt je naar /login. */
const TERUG_SLEUTEL = 'projectkaart_terug'

// Eén Supabase-client en één domein per app, gezet door de plugin.
let sb: SupabaseClient | null = null
let domein = ''
let verloopKlok: ReturnType<typeof setTimeout> | undefined

export function useGebruiker() {
  const gebruiker = useState<Gebruiker | null>('gebruiker', () => null)
  const melding = useState('inlogmelding', () => '')
  const router = useRouter()

  /** Wie bij deze sessie hoort. Een ander domein of een inlog van meer dan een week geleden: uitloggen. */
  async function zet(sessie: Session | null) {
    clearTimeout(verloopKlok)
    if (!sessie || !sb) {
      gebruiker.value = null
      return
    }
    const email = sessie.user.email ?? ''
    if (!vanDomein(email, domein)) {
      melding.value = `${email || 'Dit account'} heeft geen toegang. Log in met je e-mailadres van ${domein}.`
      gebruiker.value = null
      await sb.auth.signOut({ scope: 'local' })
      return
    }
    const moment = inlogMoment(sessie.access_token)
    const tot = moment ? verlooptOp(moment).getTime() : 0
    if (tot <= Date.now()) return verlopen(false)
    // Blijft het scherm open tot de week om is, dan alsnog uitloggen (de database laat je dan ook niet meer toe).
    verloopKlok = setTimeout(() => verlopen(true), Math.min(tot - Date.now(), 2 ** 31 - 1))
    const { data } = await sb.from('profielen').select('rol, naam').eq('id', sessie.user.id).maybeSingle()
    const meta = sessie.user.user_metadata ?? {}
    const naam = data?.naam?.trim() || meta.full_name || meta.name || ''
    gebruiker.value = { naam: naam || email, email, isMt: data?.rol === 'mt', naamNodig: !naam }
  }

  /** Alleen op dit apparaat uitloggen: een nieuwere inlog op je telefoon blijft staan. Bij het opstarten stuurt de middleware je naar /login. */
  async function verlopen(naarLogin: boolean) {
    clearTimeout(verloopKlok)
    melding.value = 'Je inlog was een week geldig en is verlopen. Vraag een nieuwe inloglink aan.'
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
  }

  /** Stuurt een inloglink naar dit adres. Alleen het eigen domein; de database weigert de rest ook. */
  async function stuurLink(email: string, terug = '/'): Promise<boolean> {
    melding.value = ''
    const adres = email.trim().toLowerCase()
    if (!vanDomein(adres, domein)) {
      melding.value = `Alleen e-mailadressen van ${domein} kunnen inloggen.`
      return false
    }
    if (!sb) return false
    try { localStorage.setItem(TERUG_SLEUTEL, veiligPad(terug)) } catch { /* dan na het inloggen naar het begin */ }
    const { error } = await sb.auth.signInWithOtp({ email: adres, options: { emailRedirectTo: `${location.origin}/login` } })
    if (error) {
      melding.value = error.status === 429
        ? 'Er is net al een link gestuurd. Wacht een minuut en probeer het dan opnieuw.'
        : `Versturen lukte niet: ${error.message}`
      return false
    }
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

  /** Je naam, voor het logboek en bij wat je aftekent. Gevraagd bij je eerste inlog. */
  async function bewaarNaam(naam: string): Promise<boolean> {
    const schoon = naam.trim().replace(/\s+/g, ' ')
    if (!sb || !gebruiker.value || schoon.length < 2) return false
    const { data } = await sb.auth.getSession()
    const { error } = await sb.from('profielen').update({ naam: schoon }).eq('id', data.session?.user.id ?? '')
    if (error) {
      melding.value = `Opslaan lukte niet: ${error.message}`
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

  return { gebruiker, melding, start, stuurLink, metLink, terugNaInloggen, bewaarNaam, naamVoorstel, uitloggen, initialen }
}

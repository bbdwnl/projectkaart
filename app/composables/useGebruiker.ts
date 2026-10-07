import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Gebruiker } from '~/lib/types'

/** In de proefversie log je in zonder account; dit is wie je dan bent. */
const PROEF: Gebruiker = { naam: 'Testgebruiker', email: null, isMt: true }
const PROEF_SLEUTEL = 'projectkaart_proefgebruiker'

function proefIngelogd(): boolean {
  try { return localStorage.getItem(PROEF_SLEUTEL) === '1' } catch { return false }
}

export function useGebruiker() {
  const gebruiker = useState<Gebruiker | null>('gebruiker', () => null)
  /** proef: nep-login en voorbeeldgegevens in de browser. supabase: Microsoft-login en de echte database. */
  const modus = useState<'proef' | 'supabase'>('modus', () => 'proef')
  const melding = useState('inlogmelding', () => '')

  /** Eenmalig vanuit de plugin. Zonder Supabase-client is het de proefversie. */
  async function start(sb: SupabaseClient | null, domein: string) {
    if (!sb) {
      modus.value = 'proef'
      gebruiker.value = proefIngelogd() ? PROEF : null
      return
    }
    modus.value = 'supabase'
    const zet = async (sessie: Session | null) => {
      if (!sessie) {
        gebruiker.value = null
        return
      }
      const email = sessie.user.email ?? ''
      if (!email.toLowerCase().endsWith(`@${domein}`)) {
        melding.value = `${email || 'Dit account'} heeft geen toegang. Log in met je account van ${domein}.`
        gebruiker.value = null
        await sb.auth.signOut()
        return
      }
      const meta = sessie.user.user_metadata ?? {}
      const { data } = await sb.from('profielen').select('rol, naam').eq('id', sessie.user.id).maybeSingle()
      gebruiker.value = { naam: data?.naam || meta.full_name || meta.name || email, email, isMt: data?.rol === 'mt' }
    }
    const { data } = await sb.auth.getSession()
    await zet(data.session)
    // Geen Supabase-aanroep direct in deze callback (die kan blokkeren): eerst een tik wachten.
    sb.auth.onAuthStateChange((gebeurtenis, sessie) => {
      if (gebeurtenis === 'SIGNED_IN' || gebeurtenis === 'SIGNED_OUT') setTimeout(() => zet(sessie))
    })
  }

  async function inloggen(terug = '/') {
    melding.value = ''
    if (modus.value === 'proef') {
      // Microsoft is nog niet gekoppeld: de knop laat je zonder account binnen.
      try { localStorage.setItem(PROEF_SLEUTEL, '1') } catch { /* privévenster: dan alleen voor deze sessie */ }
      gebruiker.value = PROEF
      await navigateTo(terug)
      return
    }
    const sb = useNuxtApp().$supabase
    if (!sb) return
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'azure',
      options: { scopes: 'email', redirectTo: `${location.origin}${terug}` },
    })
    if (error) melding.value = `Inloggen lukte niet: ${error.message}`
  }

  async function uitloggen() {
    if (modus.value === 'proef') {
      try { localStorage.removeItem(PROEF_SLEUTEL) } catch { /* niets te doen */ }
    } else {
      await useNuxtApp().$supabase?.auth.signOut()
    }
    gebruiker.value = null
    await navigateTo('/login')
  }

  const initialen = computed(() => (gebruiker.value?.naam ?? '')
    .split(/[\s.@]+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join(''))

  return { gebruiker, modus, melding, start, inloggen, uitloggen, initialen }
}

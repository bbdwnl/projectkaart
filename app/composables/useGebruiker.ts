import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Gebruiker } from '~/lib/types'

const DEMO: Gebruiker = { naam: 'Demo', email: null, isMt: true }

export function useGebruiker() {
  const gebruiker = useState<Gebruiker | null>('gebruiker', () => null)
  const modus = useState<'demo' | 'supabase'>('modus', () => 'demo')
  const melding = useState('inlogmelding', () => '')

  /** Eenmalig vanuit de plugin. */
  async function start(sb: SupabaseClient | null, domein: string) {
    if (!sb) {
      modus.value = 'demo'
      gebruiker.value = DEMO
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
    const sb = useNuxtApp().$supabase
    if (!sb) return
    melding.value = ''
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'azure',
      options: { scopes: 'email', redirectTo: `${location.origin}${terug}` },
    })
    if (error) melding.value = `Inloggen lukte niet: ${error.message}`
  }

  async function uitloggen() {
    const sb = useNuxtApp().$supabase
    if (sb) await sb.auth.signOut()
    gebruiker.value = null
    await navigateTo('/login')
  }

  const initialen = computed(() => (gebruiker.value?.naam ?? '')
    .split(/[\s.@]+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join(''))

  return { gebruiker, modus, melding, start, inloggen, uitloggen, initialen }
}

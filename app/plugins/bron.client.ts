import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Bron } from '~/data/bron'
import type { DemoGegevens } from '~/data/demo'
import { maakDemoBron, PROEF_OPSLAG } from '~/data/bron-demo'
import { maakSupabaseBron } from '~/data/bron-supabase'

// Kiest de bron. Proefversie (of geen Supabase ingesteld): nep-login en voorbeeldgegevens,
// bewaard in de browser van de tester. De gegevens komen van de server, en alleen met het
// wachtwoord van de proefversie als dat is ingesteld. Anders: Microsoft-login en de echte database.
// Herstelt de inlogsessie voordat de route-middleware draait.
export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig().public
  const proef = config.proefversie || !(config.supabaseUrl && config.supabaseKey)
  let supabase: SupabaseClient | null = null
  let bron: Bron
  let proefToegang = true
  if (proef) {
    const gegevens = await $fetch<DemoGegevens>('/api/proef/gegevens').catch(() => null)
    proefToegang = !!gegevens
    bron = maakDemoBron({ door: 'Jij', opslag: PROEF_OPSLAG, gegevens })
  } else {
    supabase = createClient(config.supabaseUrl, config.supabaseKey, { auth: { flowType: 'pkce' } })
    bron = maakSupabaseBron(supabase)
  }
  await useGebruiker().start(supabase, config.emailDomein, proefToegang)
  return { provide: { bron, supabase } }
})

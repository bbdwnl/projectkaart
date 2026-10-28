import { createClient } from '@supabase/supabase-js'
import { maakSupabaseBron } from '~/data/bron-supabase'

// De bron is Supabase: inloggen met een link per mail en de echte database. Zonder NUXT_PUBLIC_SUPABASE_URL en
// NUXT_PUBLIC_SUPABASE_KEY start de app niet. Herstelt de inlogsessie voordat de route-middleware draait.
export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig().public
  if (!config.supabaseUrl || !config.supabaseKey) {
    throw new Error('Supabase is niet ingesteld: zet NUXT_PUBLIC_SUPABASE_URL en NUXT_PUBLIC_SUPABASE_KEY (zie .env.example).')
  }
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, { auth: { flowType: 'pkce' } })
  await useGebruiker().start(supabase, config.emailDomein)
  return { provide: { bron: maakSupabaseBron(supabase), supabase } }
})

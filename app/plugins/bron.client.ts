import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Bron } from '~/data/bron'
import { maakDemoBron } from '~/data/bron-demo'
import { maakSupabaseBron } from '~/data/bron-supabase'

// Kiest de bron: Supabase als die is ingesteld, anders de demo-modus.
// Herstelt de inlogsessie voordat de route-middleware draait.
export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig().public
  let supabase: SupabaseClient | null = null
  let bron: Bron
  if (config.supabaseUrl && config.supabaseKey) {
    supabase = createClient(config.supabaseUrl, config.supabaseKey, { auth: { flowType: 'pkce' } })
    bron = maakSupabaseBron(supabase)
  } else {
    bron = maakDemoBron()
  }
  await useGebruiker().start(supabase, config.emailDomein)
  return { provide: { bron, supabase } }
})

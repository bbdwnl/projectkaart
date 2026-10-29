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
  const bron = maakSupabaseBron(supabase)
  const { gebruiker, start } = useGebruiker()
  await start(supabase, config.emailDomein)

  // De keuzelijsten uit Instellingen: met een geldige inlog meteen bij het starten (zodat het eerste scherm ze al
  // heeft), anders zodra je inlogt. Live bijgewerkt zolang je ingelogd bent.
  const nuxtApp = useNuxtApp()
  let stop: (() => void) | null = null
  const laad = () => nuxtApp.runWithContext(() => useInstellingen().laad(bron))
  if (gebruiker.value) await laad()
  watch(() => gebruiker.value?.email ?? null, (email, vorig) => {
    stop?.()
    stop = null
    if (!email) return
    if (vorig !== undefined) laad()
    stop = bron.luister([{ tabel: 'instellingen' }], () => laad())
  }, { immediate: true })
  return { provide: { bron, supabase } }
})

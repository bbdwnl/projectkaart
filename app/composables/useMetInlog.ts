/**
 * Een verzoek aan de eigen server met de inlog van deze browser (Authorization: Bearer <access token>), zodat de server
 * weet wie je bent. Voor Copilot: toestaan op /koppelen en de koppelingen onder Instellingen. Een fout wordt een Error
 * met de melding van de server.
 */
export function useMetInlog() {
  const { $supabase } = useNuxtApp()
  return async function metInlog<T>(pad: string, opties: { method?: 'GET' | 'POST' | 'DELETE', body?: object, query?: Record<string, string> } = {}): Promise<T> {
    const token = (await $supabase.auth.getSession()).data.session?.access_token
    // Zonder de getypeerde routes van Nitro: die worden te diep voor de typecheck.
    const haal = $fetch as unknown as (pad: string, o: object) => Promise<T>
    try {
      return await haal(pad, { ...opties, headers: token ? { Authorization: `Bearer ${token}` } : {} })
    } catch (e) {
      const f = e as { statusCode?: number, statusMessage?: string, data?: { statusMessage?: string } }
      throw new Error(f.statusCode === 503
        ? 'Copilot is nog niet ingesteld op de server. Vraag de beheerder NUXT_COPILOT_GEHEIM te zetten.'
        : f.data?.statusMessage || f.statusMessage || 'Dat lukte niet. Probeer het nog eens.')
    }
  }
}

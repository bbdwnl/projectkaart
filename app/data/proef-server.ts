import type { ExternAntwoord, ProefLink, ProefStand } from '~/lib/deellink'
import { BronFout } from './bron'

/**
 * Proefversie: de server bewaart een kopie van de links van een tester, zodat een leverancier ze ook op een ander
 * apparaat kan openen (server/api/proef). Los van de demo-bron, zodat die zonder server te testen is.
 */
export interface ProefServer {
  /** Zet de link op de server of werkt hem bij; terug komt wat alleen de server weet. */
  bewaar(link: ProefLink): Promise<ProefStand[]>
  /** Zet een eigen tekening van de tester bij de link, voor de leverancier. */
  uploadTekening(token: string, tekeningId: string, pdf: Blob): Promise<void>
  /** De pagina van de leverancier, voor wie de link niet in zijn eigen browser heeft. */
  inhoud(token: string, code: string): Promise<ExternAntwoord>
  tekeningUrl(token: string, code: string, tekeningId: string): Promise<string>
}

async function post<T>(pad: string, body: object): Promise<T> {
  try {
    return await ($fetch(pad, { method: 'POST', body, timeout: 20_000 }) as Promise<T>)
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    throw new BronFout(status === 503
      ? 'Delen is op de server nog niet ingesteld.'
      : status === 404 ? 'Niet gevonden: de link of de tekening staat niet (meer) op de server.' : 'De server is nu niet bereikbaar. Probeer het straks opnieuw.')
  }
}

/** `apikey`: de publieke sleutel van Supabase, als die is ingesteld; de opslag vraagt hem bij een upload. */
export function maakProefServer(apikey: string): ProefServer {
  return {
    bewaar: link => post<ProefStand[]>('/api/proef/deellinks', { links: [link] }),
    async uploadTekening(token, tekeningId, pdf) {
      const { url } = await post<{ url: string }>('/api/proef/deellink-tekening', { token, tekeningId })
      // Zoals supabase-js het doet bij een upload naar een getekend adres.
      const body = new FormData()
      body.append('cacheControl', '3600')
      body.append('', pdf)
      const res = await fetch(url, { method: 'PUT', body, headers: { 'x-upsert': 'true', ...(apikey ? { apikey } : {}) } })
      if (!res.ok) throw new BronFout(`De tekening uploaden is niet gelukt (${res.status}).`)
    },
    inhoud: (token, code) => post<ExternAntwoord>(`/api/proef/punten/${encodeURIComponent(token)}`, { code }),
    tekeningUrl: async (token, code, tekeningId) =>
      (await post<{ url: string }>(`/api/proef/punten/${encodeURIComponent(token)}/tekening/${encodeURIComponent(tekeningId)}`, { code })).url,
  }
}

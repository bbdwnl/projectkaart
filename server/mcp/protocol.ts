// Het Model Context Protocol (MCP), het deel dat Copilot nodig heeft: initialize, ping, tools/list en tools/call, als
// JSON-RPC over één POST (Streamable HTTP, zonder sessie en zonder stream). Geen eigen staat: elk verzoek staat los,
// zodat het op Vercel zonder vaste server werkt. Zonder Nuxt, zodat het te testen is (tests/copilot.test.ts).

/** Van nieuw naar oud. Vraagt een client een versie die we niet kennen, dan antwoorden we met de nieuwste. */
export const PROTOCOL_VERSIES = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

export interface Gereedschap {
  name: string
  title: string
  description: string
  inputSchema: { type: 'object', properties: Record<string, unknown>, required?: string[], additionalProperties?: boolean }
  annotations: { readOnlyHint: boolean, destructiveHint?: boolean, idempotentHint?: boolean, openWorldHint: false }
  run: (args: Record<string, unknown>) => Promise<unknown>
}

/** Een fout die de gebruiker (of Copilot) kan oplossen: komt terug als tekst bij het gereedschap, niet als storing. */
export class InvoerFout extends Error {}

export interface ServerInfo {
  naam: string
  versie: string
  instructies: string
  gereedschap: Gereedschap[]
}

type Id = string | number
interface Verzoek { jsonrpc: '2.0', id?: Id | null, method: string, params?: Record<string, unknown> }

const fout = (id: Id | null, code: number, message: string) => ({ jsonrpc: '2.0' as const, id, error: { code, message } })
const antwoord = (id: Id, result: unknown) => ({ jsonrpc: '2.0' as const, id, result })

function isVerzoek(b: unknown): b is Verzoek {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return false
  const v = b as Record<string, unknown>
  return v.jsonrpc === '2.0' && typeof v.method === 'string'
    && (v.id === undefined || typeof v.id === 'string' || typeof v.id === 'number')
    && (v.params === undefined || (typeof v.params === 'object' && v.params !== null && !Array.isArray(v.params)))
}

/** Wat een gereedschap teruggeeft, als tekst (JSON) voor het model. */
export function alsTekst(data: unknown): string {
  return typeof data === 'string' ? data : JSON.stringify(data, null, 1)
}

/**
 * Eén JSON-RPC-bericht. Een melding (zonder id) krijgt geen antwoord: null. Een reeks berichten (batch, van
 * oudere clients) krijgt een reeks antwoorden.
 */
export async function verwerk(bericht: unknown, server: ServerInfo): Promise<unknown> {
  if (Array.isArray(bericht)) {
    if (!bericht.length) return fout(null, -32600, 'Leeg verzoek.')
    const antwoorden = (await Promise.all(bericht.map(b => verwerkEen(b, server)))).filter(a => a !== null)
    return antwoorden.length ? antwoorden : null
  }
  return verwerkEen(bericht, server)
}

async function verwerkEen(bericht: unknown, server: ServerInfo): Promise<unknown> {
  if (!isVerzoek(bericht)) {
    // Een antwoord van de client (op een vraag van ons) komt niet voor: we stellen geen vragen. Dan ook geen antwoord.
    const b = bericht as Record<string, unknown> | null
    if (b && typeof b === 'object' && ('result' in b || 'error' in b)) return null
    return fout(null, -32600, 'Ongeldig JSON-RPC-verzoek.')
  }
  const { id, method, params = {} } = bericht
  if (id === undefined || id === null) return null // notifications/initialized en andere meldingen

  switch (method) {
    case 'initialize': {
      const gevraagd = typeof params.protocolVersion === 'string' ? params.protocolVersion : ''
      return antwoord(id, {
        protocolVersion: PROTOCOL_VERSIES.includes(gevraagd) ? gevraagd : PROTOCOL_VERSIES[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: server.naam, title: 'Projectkaart BbDW', version: server.versie },
        instructions: server.instructies,
      })
    }
    case 'ping':
      return antwoord(id, {})
    case 'tools/list':
      return antwoord(id, {
        tools: server.gereedschap.map(({ run: _, ...g }) => g),
      })
    case 'tools/call': {
      const naam = params.name
      const g = server.gereedschap.find(x => x.name === naam)
      if (!g) return fout(id, -32602, `Onbekend gereedschap: ${String(naam)}.`)
      const args = params.arguments ?? {}
      if (typeof args !== 'object' || args === null || Array.isArray(args)) return fout(id, -32602, 'arguments moet een object zijn.')
      try {
        const data = await g.run(args as Record<string, unknown>)
        return antwoord(id, { content: [{ type: 'text', text: alsTekst(data) }], isError: false })
      } catch (e) {
        // Een fout van de gebruiker of de database: als tekst terug, zodat Copilot het kan uitleggen of opnieuw kan proberen.
        const tekst = e instanceof Error ? e.message : 'Er ging iets mis.'
        return antwoord(id, { content: [{ type: 'text', text: tekst }], isError: true })
      }
    }
    default:
      return fout(id, -32601, `Onbekende methode: ${method}.`)
  }
}

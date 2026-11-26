import { pasToe } from '../../app/lib/instellingen'
import { vandaag } from '../../app/lib/datum'
import { verwerk } from '../mcp/protocol'
import { instructies, maakGereedschap } from '../mcp/gereedschap'

// De MCP-server voor Copilot (Microsoft 365 Copilot via Copilot Studio, GitHub Copilot in VS Code, of een andere
// MCP-client): Streamable HTTP, alleen POST, zonder sessie. Elk verzoek draagt een access token uit de OAuth-koppeling
// (Authorization: Bearer pka_…) en werkt als de medewerker die toestond (server/utils/copilot.ts). Zonder token: 401
// met de verwijzing naar /.well-known/oauth-protected-resource, zodat Copilot weet waar het moet inloggen.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  if (event.method !== 'POST') {
    // Geen stream van de server naar de client (GET) en geen sessie om te sluiten (DELETE).
    setHeader(event, 'Allow', 'POST')
    throw createError({ statusCode: 405, statusMessage: 'Alleen POST.' })
  }
  // Een andere website in de browser mag hier niet heen (DNS-rebinding); Copilot en VS Code sturen geen Origin.
  const app = appAdres(event)
  const origin = getHeader(event, 'origin')
  if (origin && origin !== app) throw createError({ statusCode: 403, statusMessage: 'Niet vanaf deze website.' })

  const sessie = await copilotSessie(event)

  let bericht: unknown
  try {
    bericht = JSON.parse((await readRawBody(event, 'utf8')) ?? '')
  } catch {
    setResponseStatus(event, 400)
    return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Geen geldige JSON.' } }
  }

  // De keuzelijsten van Instellingen (takenpakket, mensen, namen), zoals de app ze na het inloggen laadt.
  pasToe(await sessie.bron.instellingen().catch(() => []))

  const ctx = { bron: sessie.bron, nu: vandaag(), gebruiker: sessie.gebruiker, appUrl: app, geldigTot: sessie.geldigTot }
  const antwoord = await verwerk(bericht, { naam: 'projectkaart', versie: '1.1.0', instructies: instructies(ctx), gereedschap: maakGereedschap(ctx) })
  if (antwoord === null) {
    // Alleen meldingen: ontvangen, geen antwoord.
    setResponseStatus(event, 202)
    return ''
  }
  setHeader(event, 'Content-Type', 'application/json')
  return antwoord
})

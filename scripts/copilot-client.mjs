// Vraagt bij de Projectkaart een OAuth-client aan voor Microsoft 365 Copilot (het app-pakket in copilot-agent), en
// drukt af wat je in het Teams Developer Portal invult (Tools → OAuth client registration). Eén keer nodig; het geheim
// staat daarna alleen nog in het portaal. Geef het niet per mail door: vul het zelf in, of deel het via een kluis.
//
//   npm run copilot:client                         (tegen https://projectkaart.bbdw.nl)
//   npm run copilot:client -- --app=http://localhost:3000
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const app = (typeof args.app === 'string' ? args.app : 'https://projectkaart.bbdw.nl').replace(/\/+$/, '')
const TERUG = 'https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect'

const res = await fetch(`${app}/api/oauth/registreren`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_name: 'Microsoft 365 Copilot (agent Projectkaart)',
    redirect_uris: [TERUG],
    token_endpoint_auth_method: 'client_secret_post',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  }),
})
const data = await res.json().catch(() => ({}))
if (res.status !== 201 || !data.client_id || !data.client_secret) {
  console.error(`Aanvragen lukte niet (${res.status}): ${data.error_description ?? data.statusMessage ?? JSON.stringify(data)}`)
  process.exit(1)
}

console.log(`
Teams Developer Portal → Tools → OAuth client registration → New OAuth client registration:

  Registration name          Projectkaart
  Base URL                   ${app}/api/mcp
  Restrict usage by org      My organization only
  Restrict usage by app      Any Teams app
  Client ID                  ${data.client_id}
  Client secret              ${data.client_secret}
  Authorization endpoint     ${app}/koppelen
  Token endpoint             ${app}/api/oauth/token
  Refresh endpoint           ${app}/api/oauth/token
  Scope                      projectkaart
  Enable PKCE                aan (verplicht)

Na Save geeft het portaal een "OAuth client registration ID". Maak daarmee het pakket:

  npm run copilot:pakket -- --oauth-id=<dat ID>
`)

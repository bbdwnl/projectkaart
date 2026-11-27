# Agent "Projectkaart" voor Microsoft 365 Copilot

Een eigen agent (declarative agent) voor Microsoft 365 Copilot, zonder Copilot Studio. De agent gebruikt de
Projectkaart als MCP-server (`https://projectkaart.bbdw.nl/api/mcp`) en logt per medewerker in met OAuth: Copilot werkt
namens de medewerker, met diens rechten, en wat het wijzigt staat op diens naam in het logboek (beslissing 46).

| Bestand | Wat |
|---|---|
| `manifest.json` | Het app-manifest (Teams-schema 1.25): naam, iconen, en de agent. |
| `declarativeAgent.json` | De agent (schema v1.9): instructies, voorbeeldvragen, en de plugin als actie. |
| `ai-plugin.json` | De plugin (schema v2.4): de MCP-server met OAuth. Geen lijst met tools: Copilot haalt ze zelf op (`tools/list`), dus nieuwe tools komen er vanzelf bij zonder nieuw pakket. |
| `color.png`, `outline.png` | De iconen (192×192 in kleur, 32×32 wit op transparant), getekend door `scripts/copilot-pakket.mjs` uit de vormen van het logo. |

## Zo komt de agent in Copilot

**1. Een client aanvragen bij de Projectkaart** (één keer, door wie de repo heeft):

```bash
npm run copilot:client
```

Dit drukt client-ID, client-geheim en alle andere waarden voor stap 2 af. Het geheim staat daarna nergens anders: geef
het niet per mail door. Vul het zelf in het portaal in, of deel het via een wachtwoordkluis.

**2. Iemand van het MT keurt de client goed:** Projectkaart → Instellingen → Copilot, de client "Microsoft 365 Copilot
(agent Projectkaart)" → Goedkeuren (beslissing 47). Zonder goedkeuring kan niemand toestaan.

**3. OAuth registreren in het Teams Developer Portal** (https://dev.teams.microsoft.com → Tools → OAuth client
registration → New OAuth client registration), met de waarden uit stap 1:

| Veld | Waarde |
|---|---|
| Registration name | Projectkaart |
| Base URL | `https://projectkaart.bbdw.nl/api/mcp` |
| Restrict usage by org | My organization only |
| Restrict usage by app | Any Teams app |
| Client ID / Client secret | uit stap 1 |
| Authorization endpoint | `https://projectkaart.bbdw.nl/koppelen` |
| Token endpoint en Refresh endpoint | `https://projectkaart.bbdw.nl/api/oauth/token` |
| Scope | `projectkaart` |
| Enable PKCE | aan (verplicht) |

Na Save geeft het portaal een **OAuth client registration ID**. Microsoft gebruikt het terugadres
`https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect`; dat staat in de lijst van toegestane adressen
(`redirectSoort` in `server/mcp/oauth.ts`).

**4. Het pakket maken** met dat ID:

```bash
npm run copilot:pakket -- --oauth-id=<OAuth client registration ID>
```

Dat geeft `copilot-agent/dist/projectkaart-copilot-1.0.0.zip` (niet in git).

**5. Uploaden door een beheerder van Microsoft 365:** Microsoft 365-beheercentrum → Agents (Alle agents / Uploaden van
een aangepaste agent), of Teams-beheercentrum → Teams-apps → Apps beheren → Uploaden. Beschikbaar maken voor iedereen
of eerst een testgroep.

**6. Gebruiken:** in Microsoft 365 Copilot (Teams, Outlook of m365.cloud.microsoft) staat links bij Agents
"Projectkaart". De eerste keer vraagt Copilot om in te loggen bij de Projectkaart: inloggen (link of code uit de mail),
Toestaan. Daarna blijft het werken zolang het gebruikt wordt (30 dagen zonder gebruik, of een jaar: opnieuw).

## Een nieuwe versie

Instructies of voorbeeldvragen aangepast: verhoog `version` in `manifest.json` (bijvoorbeeld 1.0.1), maak het pakket
opnieuw (stap 4, hetzelfde ID) en laat het opnieuw uploaden. Nieuwe tools in de Projectkaart zelf hebben geen nieuw
pakket nodig.

## Gecontroleerd

- De drie JSON-bestanden tegen de schema's van Microsoft (Teams 1.25, declarative agent v1.9, plugin v2.4).
- De route lokaal nagespeeld tegen een echte Supabase: client aanvragen, goedkeuren door het MT, toestaan met het
  terugadres van Teams, token met client-geheim en PKCE, `tools/list` met alle tools.
- Nog niet: de upload in een echte tenant en het inloggen vanuit Copilot zelf.

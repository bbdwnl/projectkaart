# Projectkaart BbDW

Eén plek per project: wat klaar is, wat openstaat en wie wat heeft afgetekend. Per project een
kaart met een stoplicht dat zichzelf uitrekent, de procesflow van lead tot nazorg, de planning,
standaardtaken plus uitzonderingen, documentlinks naar SharePoint en een logboek.
Nuxt 4 + Supabase (Frankfurt). Live op **https://projectkaart.bbdw.nl** (Vercel).

- **Vormgeving:** [design-referentie.html](design-referentie.html), open in de browser
- **Beslissingen, advies en open vragen:** [docs/BESLISSINGEN.md](docs/BESLISSINGEN.md) ← lees dit eerst

## Draaien

```bash
npm install
npm run dev        # http://localhost:3000
```

De app draait altijd op Supabase: zet `NUXT_PUBLIC_SUPABASE_URL` en `NUXT_PUBLIC_SUPABASE_KEY` in `.env`
(zie [.env.example](.env.example)), anders start hij niet. Lokaal kan dat ook een eigen Supabase zijn
(`supabase start`, met Docker); de mail met de inloglink komt dan in Mailpit.

## Controles

```bash
npm run check      # tests (logica + migraties op PGlite) en typecheck
npm run build
```

## Inrichten

1. **Database.** Koppel het Supabase-project (`supabase link`), zet het schema erop met
   `supabase db push` en vul de projecten met `supabase/seed.sql` (SQL-editor). Na een wijziging
   in `app/data/projecten.json`: `npm run seed:sql`.
2. **Inloggen met een link per mail.** In Supabase onder Authentication:
   - **SMTP** (Emails → SMTP Settings): een eigen mailserver is nodig. Zonder stuurt Supabase alleen naar
     leden van het Supabase-team, en maar een paar mails per uur. Bijvoorbeeld Microsoft 365 van BBDW:
     `smtp.office365.com`, poort 587, een postvak als `projectkaart@bbdw.nl` waarvoor de IT-partij
     SMTP AUTH aanzet. Zet daarna onder Rate Limits het aantal mails per uur ruim genoeg (bijvoorbeeld 100).
   - **Templates** (Emails → Templates): bij **Magic link** én **Confirm signup** de inhoud van
     [supabase/templates/inloglink.html](supabase/templates/inloglink.html), onderwerp
     "Je inloglink voor de Projectkaart". De link gaat naar `/login` van de app; pas een klik daar gebruikt
     hem, zodat de linkscanner van Outlook hem niet opmaakt. Hij werkt ook in een andere browser. In dezelfde mail
     staat een code: die typ je op de loginpagina in het venster waar je de link aanvroeg, als de link elders opengaat
     (bijvoorbeeld het inlogvenster van Copilot in Outlook of Teams). Link en code maken elkaar op. **Zet de nieuwe
     template ook in Supabase** als je hem daar al had staan.
   - **Providers**: Email aan, met Confirm email aan. De link is een uur geldig (Email OTP Expiration 3600).
     Alle andere providers uit (ook Azure van eerder, en Anonymous Sign-Ins). Alleen een inlog met een link per
     mail geeft toegang; de database bewaart geen wachtwoorden, dus inloggen met een wachtwoord kan niet.
   - **URL Configuration**: Site URL = `https://projectkaart.bbdw.nl` (zonder `/` aan het eind). De link in de
     inlogmail is daarop gebouwd (`{{ .SiteURL }}`), dus een ander adres hier stuurt iedereen naar dat adres.
     Bij Redirect URLs `https://projectkaart.bbdw.nl/**` en `http://localhost:3000/**`.
   - **Niet** aanzetten onder Authentication → Sessions (alleen op een betaald plan): *Time-box user sessions* en *Inactivity timeout*. Dat zou ook de sessies
     achter de koppelingen met Copilot afkappen. De app en de database houden zelf bij wanneer een inlog verloopt.
3. **Omgeving** (Vercel en `.env`, zie [.env.example](.env.example)):
   `NUXT_PUBLIC_SUPABASE_URL` en `NUXT_PUBLIC_SUPABASE_KEY`. In Vercel onder Domains: `projectkaart.bbdw.nl` als
   hoofddomein, en het oude `projectkaart-nine.vercel.app` met een doorverwijzing (308) daarnaartoe.
4. **Delen met leveranciers.** Zet in Vercel `NUXT_SUPABASE_SERVICE_KEY` (Supabase → Project Settings → API:
   de service-role of secret key). Die sleutel blijft op de server: alleen `server/api/punten` gebruikt hem om
   de pagina van een leverancier te vullen, na controle van de link en de code. Zonder sleutel werkt de rest
   van de app gewoon, maar opent een gedeelde link niet.
5. **MT.** Wie de financiën mag zien, de catalogus beheert en de keuzelijsten onder Instellingen aanpast, zet je na de eerste login in de
   SQL-editor op MT: `update profielen set rol = 'mt' where email = 'naam@bbdw.nl';`
   Een naam corrigeren gaat ook daar (iedereen kiest zijn naam één keer):
   `update profielen set naam = 'Jan de Vries' where email = 'jan@bbdw.nl';`
6. **Nieuwe externe dienst in de browser** (bijvoorbeeld Microsoft Graph voor SharePoint): zet de host in de
   Content-Security-Policy in [server/utils/koppen.ts](server/utils/koppen.ts), anders blokkeert de browser hem. Scripts
   mogen alleen van de app zelf komen: de twee regels script die Nuxt in de pagina zet, krijgen per antwoord hun hash in
   de CSP (`server/plugins/koppen.ts`), dus `'unsafe-inline'` is er niet.
6. **Back-up.** Elke nacht om 03:00 UTC maakt Vercel Cron een back-up: alle rijen van alle tabellen als één
   SQL-bestand in de besloten bucket `backups` in Supabase Storage (Frankfurt), 30 dagen bewaard. Zet daarvoor in
   Vercel `CRON_SECRET` (een lang willekeurig geheim, bijvoorbeeld `openssl rand -hex 32`) naast
   `NUXT_SUPABASE_SERVICE_KEY`. Zonder `CRON_SECRET` doet de route niets. De bestanden staan in Supabase onder
   Storage → backups (alleen voor wie het Supabase-project beheert). Foto's en tekeningen zitten er niet in; die
   staan in Storage zelf.

   **Terugzetten:** maak een lege database met het schema (`supabase db push` op een nieuw project), download het
   bestand van de gewenste dag en voer het uit in de SQL-editor. Het zet triggers en verwijzingen uit tijdens het
   terugzetten, zodat wie en wanneer blijven zoals ze waren, en zet de teller van het logboek goed. Op een database
   waar al gegevens in staan, stopt het bij de eerste dubbele rij en verandert het niets.

7. **Copilot (MCP, met OAuth).** De app is een MCP-server op `/api/mcp` en een eigen OAuth-server (beslissing 46).
   Zet de migratie erop (`supabase db push`) en zet in Vercel, naast `NUXT_SUPABASE_SERVICE_KEY`:
   - `NUXT_COPILOT_GEHEIM`: minstens 32 tekens (`openssl rand -hex 32`). Zonder geheim geven de routes 503 en werkt
     de rest gewoon. Verander je het, dan werken de bestaande koppelingen niet meer en logt iedereen opnieuw in.
   - `NUXT_PUBLIC_APP_URL`: het vaste adres van de app: `https://projectkaart.bbdw.nl` (zonder `/`
     aan het eind). Dat is de uitgever van de tokens; zonder valt hij terug op het adres van het verzoek.

   **Microsoft 365 Copilot (via Copilot Studio), één keer door de beheerder van Microsoft 365:** in Copilot Studio een
   agent → Tools → Add a tool → New tool → Model Context Protocol. Server name *Projectkaart*, Server URL
   `https://projectkaart.bbdw.nl/api/mcp`, Authentication **OAuth 2.0 → Dynamic discovery**. Copilot Studio vindt de
   rest zelf (`/.well-known/oauth-protected-resource` en `/.well-known/oauth-authorization-server`) en registreert zich,
   met een eigen geheim en PKCE. Bij *Create a new connection* logt iemand met een `@bbdw.nl`-adres in op `/koppelen` en
   kiest Toestaan. **Een programma dat zich voor het eerst meldt, moet door iemand van het MT zijn goedgekeurd**
   (beslissing 47): is de maker MT, dan doet hij dat op `/koppelen` in één keer (*Goedkeuren en toestaan*); anders keurt
   het MT het goed onder Instellingen → Copilot (*Programma's die mogen koppelen*) en begint de maker opnieuw. Zonder
   goedkeuring geeft de database geen code. Daar trekt het MT een programma ook weer in; wat na een week niet is
   goedgekeurd, verdwijnt vanzelf. **Daarna, belangrijk:** de verbinding van de tool op de inlog van de gebruiker zetten (*end user
   credentials*), niet op die van de maker; anders werkt iedereen onder de naam van de maker. Dan Publish, en onder
   Channels → Microsoft 365 en Microsoft Teams met *Make agent available in Microsoft Copilot*. Een DLP-beleid van Power
   Platform moet de verbinding toelaten (MCP-tools lopen via connectoren).

   Het terugadres van Copilot Studio (`*.consent.azure-apim.net`) staat in de lijst van toegestane adressen
   (`redirectSoort` in `server/mcp/oauth.ts`). Microsoft documenteert het niet; gebruikt Copilot Studio een ander adres,
   dan mislukt het registreren en staat er in de log van Vercel `[copilot] registreren geweigerd` met het adres. Zet die
   host dan in `NUXT_COPILOT_TERUGADRESSEN` (Vercel) en deploy opnieuw; de code hoeft niet te veranderen.

   **Microsoft 365 Copilot zonder Copilot Studio (eigen agent als app-pakket):** de map
   [copilot-agent](copilot-agent/README.md) heeft een declarative agent met de Projectkaart als MCP-plugin. Geen
   Copilot Studio-omgeving, geen DLP-beleid en geen credits nodig. `npm run copilot:client` vraagt een client aan, het
   MT keurt hem goed, een beheerder registreert OAuth in het Teams Developer Portal, `npm run copilot:pakket --
   --oauth-id=…` maakt de zip, en een beheerder uploadt die. Stappen en waarden in `copilot-agent/README.md`.

   **Per medewerker:** de eerste keer dat Copilot de projectkaart gebruikt, vraagt het om in te loggen. Dat opent
   `/koppelen` in de app (eerst inloggen als je nog niet bent ingelogd: met de link, of met de code uit dezelfde mail
   als de link in een andere browser opengaat), en
   daar kies je **Toestaan**. Een koppeling blijft werken zolang de medewerker Copilot gebruikt: na 30 dagen zonder gebruik, of een jaar na toestaan, vraagt Copilot opnieuw (`copilot_stilte()` en `copilot_hoogstens()` in de migratie). Inloggen in de browser verlengt ook bij gebruik (30 dagen, zonder maximum). Onder
   Instellingen → Copilot zie je je koppelingen en ontkoppel je ze.

   **GitHub Copilot in VS Code:** [.vscode/mcp.json](.vscode/mcp.json) staat in de repo (`projectkaart` wijst naar
   productie, `projectkaart-lokaal` naar `npm run dev`), of MCP: Add Server → HTTP met
   `https://projectkaart.bbdw.nl/api/mcp`. VS Code doet OAuth zelf en
   opent `/koppelen`; ook die registratie keurt het MT eerst goed (één keer per VS Code-installatie). Kies in de chat de
   modus **Agent**.

   Copilot mag wat de medewerker mag en wat het wijzigt of aftekent, staat op diens naam in het logboek. Het kan
   projecten zoeken en bekijken (met het stoplicht), het logboek, opmerkingen en acties lezen, en taken, projectgegevens
   en acties bijwerken; niet verwijderen, niet aan financiën of instellingen. De koppelingen staan in `oauth_clients`
   (met wie van het MT het programma goedkeurde), `oauth_codes` en `copilot_koppelingen` (tokens alleen als hash, de
   sessie versleuteld); alleen de server leest die.

Alleen e-mailadressen op `@bbdw.nl` komen erin. De database maakt voor een ander adres geen account aan
(dus gaat er ook geen link naartoe), en de RLS-policies laten alleen `@bbdw.nl` toe (`toegestane_domeinen()`).
Een inlog blijft geldig zolang je de app gebruikt; na 30 dagen zonder gebruik ben je uitgelogd (`inlogduur()` en
`ik_ben_actief()` in de migratie inlog_verlengt, `INLOGDUUR_DAGEN` in `app/lib/inlog.ts`). Daarna vraag je een nieuwe link aan. Bij de eerste inlog
vraagt de app je naam: die staat in het logboek en bij wat je aftekent. Je kiest hem één keer, en niet een naam
die een collega al heeft; daarna wijzigt alleen een beheerder hem (stap 5), zodat niemand onder andermans naam aftekent.

## Opbouw

| Map | Wat |
|---|---|
| `app/lib/` | De regels, zonder Nuxt: fasen, standaardtaken, deadlines en stoplicht, standzin, uitzonderingen, weergave. Getest in `tests/`. |
| `app/data/` | De bron (`bron.ts`, uitgevoerd in `bron-supabase.ts`) en de startgegevens uit het prototype (`projecten.json`, voor `seed.sql`). |
| `app/composables/useProjectkaart.ts` | Alles van één projectkaart: laden, stoplicht per fase, wijzigen (direct op het scherm, terug bij een fout). |
| `app/components/` | `kaart/` (kop, stoplicht, tabbladen, weergave), `taken/`, `proces/`, `details/`. |
| `supabase/migrations/` | Schema, rechten (RLS), triggers voor aftekenen en het logboek. |
| `server/utils/koppen.ts`, `server/plugins/koppen.ts` | De beveiligingskoppen (CSP, HSTS, geen frames) voor elk antwoord, en per pagina de CSP met de hashes van de scripts die Nuxt erin zet, zonder `x-powered-by`. Getest in `tests/koppen.test.ts`. |
| `server/mcp/`, `server/api/mcp.ts`, `server/api/oauth/` | De MCP-server voor Copilot: het protocol, het gereedschap (op de Bron en de regels uit `app/lib`) en de regels van OAuth. De stappen van OAuth staan in `server/utils/oauth.ts`, de sessie per koppeling in `server/utils/copilot.ts`, de toestemmingspagina in `app/pages/koppelen.vue`. Getest in `tests/copilot.test.ts`. |

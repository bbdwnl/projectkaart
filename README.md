# Projectkaart BbDW

Eén plek per project: wat klaar is, wat openstaat en wie wat heeft afgetekend. Per project een
kaart met een stoplicht dat zichzelf uitrekent, de procesflow van lead tot nazorg, de planning,
standaardtaken plus uitzonderingen, documentlinks naar SharePoint en een logboek.
Nuxt 4 + Supabase (Frankfurt).

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
     hem, zodat de linkscanner van Outlook hem niet opmaakt. Hij werkt ook in een andere browser.
   - **Providers**: Email aan, met Confirm email aan. De link is een uur geldig (Email OTP Expiration 3600).
   - **URL Configuration**: Site URL = het adres van de app op Vercel. Bij Redirect URLs dat adres en
     `http://localhost:3000`, elk met `/**` erachter.
   - Optioneel, op een betaald plan: Sessions → Time-box user sessions op 168 uur. De app en de database
     houden de week ook zelf bij.
3. **Omgeving** (Vercel en `.env`, zie [.env.example](.env.example)):
   `NUXT_PUBLIC_SUPABASE_URL` en `NUXT_PUBLIC_SUPABASE_KEY`.
4. **Delen met leveranciers.** Zet in Vercel `NUXT_SUPABASE_SERVICE_KEY` (Supabase → Project Settings → API:
   de service-role of secret key). Die sleutel blijft op de server: alleen `server/api/punten` gebruikt hem om
   de pagina van een leverancier te vullen, na controle van de link en de code. Zonder sleutel werkt de rest
   van de app gewoon, maar opent een gedeelde link niet.
5. **MT.** Wie de financiën mag zien en de catalogus beheert, zet je na de eerste login in de
   SQL-editor op MT: `update profielen set rol = 'mt' where email = 'naam@bbdw.nl';`

Alleen e-mailadressen op `@bbdw.nl` komen erin. De database maakt voor een ander adres geen account aan
(dus gaat er ook geen link naartoe), en de RLS-policies laten alleen `@bbdw.nl` toe (`toegestane_domeinen()`).
Een inlog geldt een week vanaf het moment van inloggen; gebruik verlengt hem niet (`inlogduur()` in de
migratie, `INLOGDUUR_DAGEN` in `app/lib/inlog.ts`). Daarna vraag je een nieuwe link aan. Bij de eerste inlog
vraagt de app je naam: die staat in het logboek en bij wat je aftekent.

## Opbouw

| Map | Wat |
|---|---|
| `app/lib/` | De regels, zonder Nuxt: fasen, standaardtaken, deadlines en stoplicht, standzin, uitzonderingen, weergave. Getest in `tests/`. |
| `app/data/` | De bron (`bron.ts`, uitgevoerd in `bron-supabase.ts`) en de startgegevens uit het prototype (`projecten.json`, voor `seed.sql`). |
| `app/composables/useProjectkaart.ts` | Alles van één projectkaart: laden, stoplicht per fase, wijzigen (direct op het scherm, terug bij een fout). |
| `app/components/` | `kaart/` (kop, stoplicht, tabbladen, weergave), `taken/`, `proces/`, `details/`. |
| `supabase/migrations/` | Schema, rechten (RLS), triggers voor aftekenen en het logboek. |

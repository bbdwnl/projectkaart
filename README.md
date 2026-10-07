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

De app start als **proefversie**: de knop "Inloggen met Microsoft" laat je zonder account binnen,
en alles draait op voorbeeldgegevens (de 27 lopende projecten en hun datums uit het prototype,
met verzonnen statussen). Wat een tester verandert, blijft in zijn eigen browser bewaard; via het
menu rechtsboven begin je opnieuw.

## Controles

```bash
npm run check      # tests (logica + migraties op PGlite) en typecheck
npm run build
```

## Van proefversie naar echt

1. **Database.** Koppel het Supabase-project (`supabase link`), zet het schema erop met
   `supabase db push` en vul de projecten met `supabase/seed.sql` (SQL-editor). Na een wijziging
   in `app/data/projecten.json`: `npm run seed:sql`.
2. **Microsoft-login.** Laat de IT-beheerder in Entra ID een app-registratie maken (één tenant,
   redirect `https://<project>.supabase.co/auth/v1/callback`). Zet in Supabase onder
   Authentication → Providers de provider **Azure** aan met de client-id, het secret en de tenant-URL
   (`https://login.microsoftonline.com/<tenant-id>`). Zet e-mail/wachtwoord uit. Voeg de site-URL
   (Vercel en `http://localhost:3000`) toe aan de toegestane redirect-URL's.
3. **Omgeving** (Vercel en `.env`, zie [.env.example](.env.example)):
   `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_KEY` en `NUXT_PUBLIC_PROEFVERSIE=false`.
4. **MT.** Wie de financiën mag zien en de catalogus beheert, zet je na de eerste login in de
   SQL-editor op MT: `update profielen set rol = 'mt' where email = 'naam@bbdw.nl';`

Alleen Microsoft-accounts met een e-mailadres op `@bbdw.nl` komen erin; dat staat in de RLS-policies
(`toegestane_domeinen()` in de migratie) en wordt in de app nog eens gecontroleerd.

## Opbouw

| Map | Wat |
|---|---|
| `app/lib/` | De regels, zonder Nuxt: fasen, standaardtaken, deadlines en stoplicht, standzin, uitzonderingen, weergave. Getest in `tests/`. |
| `app/data/` | De bron: `bron-supabase.ts` (echt) en `bron-demo.ts` (proefversie), plus de startgegevens uit het prototype. |
| `app/composables/useProjectkaart.ts` | Alles van één projectkaart: laden, stoplicht per fase, wijzigen (direct op het scherm, terug bij een fout). |
| `app/components/` | `kaart/` (kop, stoplicht, tabbladen, weergave), `taken/`, `proces/`, `details/`. |
| `supabase/migrations/` | Schema, rechten (RLS), triggers voor aftekenen en het logboek. |

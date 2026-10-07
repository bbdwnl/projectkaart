# Projectkaart: beslissingen, advies en open vragen

Stand 07-10-2026. Elke keuze volgt het gesprek met de opdrachtgever of het aanbevolen standaardantwoord,
en staat open voor herziening. Bronnen: het prototype van Benno (de "live" lijsten en de procesflow),
de offerte "Van oud naar nieuw" (fase B) en [design-referentie.html](../design-referentie.html).

## Product

| # | Beslissing | Keuze | Waarom / alternatief |
|---|---|---|---|
| 1 | Fasen en rollen | Lead → Haalbaarheid → Ontwikkeling → Uitvoering → Nazorg, met AM (lead, haalbaarheid), PO (ontwikkeling) en PM (uitvoering, nazorg) | Zoals in het prototype. De rol bedrijfsleider vervalt. |
| 2 | Stoplicht | **Wordt uitgerekend, nooit met de hand gezet.** Groen = definitief én document gekoppeld. Oranje = definitief zonder document, n.v.t. zonder reden, of deadline binnen 14 dagen. Rood = deadline voorbij. Grijs = n.v.t. (met reden) of volgende fase | Als mensen zelf kleuren kiezen, vult ieder de lijst weer anders in. "Geen groen zonder document" maakt aftekenen en het vinden van het definitieve stuk één handeling. |
| 3 | Overdracht (gate) | **Geen harde gate.** Iedereen kan de fase aanpassen; het logboek houdt bij wie. De procesflow toont per overdracht wat er klaar moet zijn, afgeleid uit de taken | Keuze opdrachtgever. |
| 4 | Standaardpakket | De lijsten uit het prototype, met dezelfde sleutels (`app/lib/taken.ts`) | Zo kunnen de live statussen uit het prototype één op één worden overgezet. |
| 5 | Deadlines | Haalbaarheid: 2 weken vóór start voorbereiding. Ontwikkeling: teruggerekend vanaf inkoop gereed (casco-stukken vanaf start casco als die eerder valt), nooit vóór start voorbereiding. Inkoop afbouw: vóór start afbouw. Nazorg: opleverpunten 3 weken en financiële afhandeling 6 weken na oplevering | Regels uit het prototype en de procesflow. De documentenlijst afbouw heeft geen deadline, net als in het prototype: zie open vraag 2. |
| 6 | Uitzonderingen | Per project toe te voegen, **altijd uit één gedeelde catalogus** (of als nieuwe regel erin). Een kandidaat voor het standaardpakket bij ≥ 4 projecten, of ≥ 20% van de projecten die die fase bereikten (en minstens 2). Het MT zet een kandidaat op "voorgesteld" of "standaard" | Vrije tekst per project is niet te tellen. De pagina Uitzonderingen toont ook de keerzijde: standaardtaken die vaak n.v.t. zijn. "Standaard" betekent nu: komt in de volgende versie van het pakket (dat staat nog in de code). |
| 7 | Klantakkoord | Een vinkje per taak; de database legt vast wie en wanneer | Keuze opdrachtgever: een akkoord kan op verschillende onderdelen vallen. |
| 8 | Wat openstaat eerst | De takenlijst opent op het filter **Open** (Open · Klaar · Alles), het dringendste bovenaan. Een taak die klaar is, glijdt na zijn stempel uit de lijst | Keuze opdrachtgever. Geldt ook voor het overzicht (fase C). |
| 9 | Indeling | Kop (standzin, stoplicht, planningstrook) en drie tabbladen: **Taken**, **Proces & Planning**, **Details**. Via "Weergave aanpassen" zet je onderdelen en kolommen aan of uit; bewaard in een cookie per apparaat, de kaart opent met het laatste tabblad | Keuze opdrachtgever. Later eventueel bij de gebruiker opslaan, zodat het meegaat naar een ander apparaat. |
| 10 | Vormgeving | Design system "Wat als ik later dood ben?" (kaart met tab, 2px zwarte rand, Schibsted Grotesk), kleuren van het BbDW-logo: salie = klaar, oker = let op, baksteen = te laat, blauw = huidige fase en focus. Een stand heeft altijd een woord, nooit alleen een kleur | Het stoplicht is het logo. Het logo is als SVG nagebouwd op zijn raster (`app/components/BbdwLogo.vue`, `public/logo-bbdw.svg`); de favicon is de officiële van bbdw.nl. Vraag het origineel aan de ontwerper. |
| 11 | AFAS | Elk project heeft een eigen veld **AFAS-nummer** (uniek), te zien in de kop en te wijzigen onder Details | De sleutel voor een latere koppeling. Als het projectnummer (P20038) hetzelfde is als het AFAS-nummer, voegen we de velden samen. |
| 12 | Financiën | Alleen het MT, afgedwongen in de database. Velden zoals in het financieel overzicht van het prototype | Bedragen komen later via een import. |
| 13 | Tekeningen | Op aanvraag; per project een tekstveld met de locatie op de server, met kopieerknop | Browsers openen geen serverpaden. |
| 14 | Proefversie | Zolang Microsoft niet is gekoppeld: de inlogknop laat je zonder account binnen, voorbeeldgegevens, wijzigingen per tester in zijn eigen browser | Om de kaart te laten bekijken voordat de koppeling er is. Uit met `NUXT_PUBLIC_PROEFVERSIE=false`. |

## Techniek

| # | Beslissing | Keuze | Waarom / alternatief |
|---|---|---|---|
| 15 | Framework | Nuxt 4.5 als SPA (geen SSR), handgeschreven CSS uit de design-referentie, Vercel | Zoals de andere projecten. Alles zit achter de login, dus SSR voegt niets toe. |
| 16 | Database en rechten | Supabase in Frankfurt. De browser praat rechtstreeks met de database; RLS bepaalt wat mag: alleen Microsoft-logins (provider azure) met een `@bbdw.nl`-adres, financiën alleen MT, niemand kan zichzelf MT maken | Getest op PGlite (`tests/migraties.test.ts`). |
| 17 | Aftekenen en logboek | Wie aftekent, een klantakkoord vastlegt of iets wijzigt, vult de database zelf in (triggers). Alleen de trigger schrijft in het logboek | De browser kan dit niet vervalsen: dat is de basis voor "hoe weet ik of het is afgetekend". |
| 18 | Documenten | Nu: de link naar het definitieve bestand plakken. Daarna: kiezen uit de projectmap via Microsoft Graph, met de versie erbij, zodat een taak oranje wordt als het bestand na aftekenen verandert | Zie advies hieronder. |
| 19 | Bron | Eén interface, twee uitvoeringen: Supabase en de proefversie (`app/data/`) | De schermen werken in beide hetzelfde. |

## Advies

### SharePoint-indeling

Eén site **Projecten**, één map per project met nummer en naam (`P20038 Apeldoorn Vlijtseweg`), met vaste submappen
die de fasen volgen:

```
01 Haalbaarheid          VO, STIKO, demarcatie, m²-verdeelstaat, principeverzoek, basisopdracht
02 Ontwerp               DO casco, installaties en afbouw, constructie, PvE, brandveiligheid, details
03 Vergunning            vergunningsset, adviseurs, welstand en bestemmingsplan
04 Inkoop & contracten   offertes, opdrachten, aanbesteding casco, huurovereenkomsten
05 Uitvoering            uitvoeringsset, documentenlijst afbouw, verslagen bouwoverleg, meer- en minderwerk
06 Oplevering & nazorg   opleverpunten, energielabel, revisie
07 Klant & akkoorden     akkoorden, correspondentie, verslagen met de klant
99 Extern gedeeld        alleen wat externe partijen mogen zien; per partij een link
```

Financiën in een aparte site, alleen voor het MT. Eén site in plaats van een site per project: één set rechten,
één koppeling voor de app en één afbakening voor Copilot. Nieuwe projecten beginnen in deze indeling; lopende
projecten verhuizen alleen hun definitieve stukken, op het moment dat ze aan een taak worden gekoppeld.

### Het definitieve document

"Definitief" staat in de projectkaart, niet in de bestandsnaam: je markeert het door het bestand aan de taak
te koppelen, en de kaart legt vast wie en wanneer. Voor de vindbaarheid: `P20038 – DO Casco – rev D.pdf`
(nummer – onderdeel – versie). Werk liever één bestand bij dan dat je kopieën maakt; SharePoint bewaart de
versies. Zodra de Graph-koppeling er is, wordt een taak oranje als het bestand na het aftekenen is veranderd.

### Beheer en rechten in Microsoft 365

"Iedereen is een beetje beheerder" is een risico, en meer nog met Copilot: Copilot laat iedereen alles zien
waar hij bij kan.

- Globale beheerder alleen voor de externe IT-partij en één noodaccount bij BBDW (Benno), met tweestapsverificatie.
- Vraag de IT-partij om twee app-registraties: een om in te loggen (alleen BBDW-accounts, alleen e-mail en
  profiel), en een met **Sites.Selected** alleen op de site Projecten, zodat de app daar documenten kan lezen.
- De app leest SharePoint aan de serverkant met die tweede registratie, niet als de ingelogde gebruiker. Dat is
  nodig voor de publieke kaart voor externe partijen; de site Projecten is voor alle medewerkers toch open.

### Copilot

Teams wordt nauwelijks gebruikt, dus geen tabblad in Teams. Copilot werkt wel in Outlook, Word en SharePoint:
later schrijft de kaart per project een korte stand ("Projectkaart.md") in de projectmap, of een Copilot-connector
leest de database, zodat Copilot kan antwoorden op "waar staat project X?".

## Open vragen

1. **Leersum** heeft in het prototype twee projectnummers: P23028 (nieuwste lijst, 29-09) en P18040 (koppeling
   financieel). Nu: P23028.
2. **Documentenlijst afbouw:** moeten die stukken een deadline krijgen, bijvoorbeeld een aantal weken vóór
   start afbouw? Nu zonder deadline, zodat ze nooit rood worden.
3. **AFAS:** is het AFAS-nummer hetzelfde als het projectnummer? Dan voegen we de velden samen.
4. **Wie is MT** (financiën, catalogus beheren)? En zijn er naast `bbdw.nl` nog andere e-maildomeinen?
5. **Externe partijen:** welke gegevens mogen op de publieke kaart, en hoe delen we grote tekeningen?

## Volgende stappen

1. Schema en projecten in Supabase zetten (na akkoord), MT-rollen toekennen.
2. Microsoft koppelen: app-registraties door de IT-partij, daarna `NUXT_PUBLIC_PROEFVERSIE=false`.
3. De live statussen uit het prototype overzetten (export van Benno).
4. Documenten kiezen uit SharePoint via Microsoft Graph, met "gewijzigd na aftekenen".
5. Fase C: het overzicht over alle projecten. Daarna de publieke kaart voor externe partijen.

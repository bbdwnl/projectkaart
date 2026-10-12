-- Proefversie: links voor leveranciers die ook buiten de browser van de tester werken.
-- In de proefversie staan de gegevens in de browser van de tester. Maakt die een link, dan zet de browser via de server
-- een kopie van wat de leverancier mag zien hier neer, en werkt hem bij als er iets verandert. De server controleert
-- de code en houdt bij wanneer er is gekeken. Tekeningen die de tester zelf uploadde, staan in de bucket proef.
-- Alleen de server komt erbij (service-rol): geen policies. Weg zodra de proefversie uit is:
--   drop table public.proef_deellinks;  en de bucket proef leegmaken en weghalen.

create table public.proef_deellinks (
  token text primary key check (token ~ '^[0-9a-f]{64}$'),
  code text not null check (code ~ '^[2-9]{5}$'),
  geldig_tot timestamptz not null,
  gesloten_op timestamptz,
  gesloten_reden text check (gesloten_reden in ('opgelost', 'ingetrokken', 'geblokkeerd')),
  foute_pogingen integer not null default 0 check (foute_pogingen >= 0),
  bekeken_op timestamptz,
  inhoud jsonb not null,
  voorbeeld_tekeningen text[] not null default '{}',
  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now(),
  -- Ook in de proefversie hooguit een maand (een dag speling voor de klok van de tester).
  check (geldig_tot <= aangemaakt_op + interval '1 month 1 day'),
  check ((gesloten_op is null) = (gesloten_reden is null))
);
comment on table public.proef_deellinks is 'Alleen proefversie: kopie van een deellink uit de browser van een tester. Alleen de server (service-rol).';

alter table public.proef_deellinks enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proef', 'proef', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

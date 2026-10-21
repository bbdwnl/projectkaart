-- Uit het prototype (beslissing 33): wachtkamer, subfase en buddy op het project; leveranciers per discipline;
-- een actielijst per project voor het overleg, met de e-mailadressen van de actiehouders; en live bijwerken.

-- Een lead in de wachtkamer: nog niet actief, wel in beeld. De subfase van haalbaarheid: SO of ontwikkeling VO.
-- De buddy kijkt mee: hij staat licht in het planningsoverzicht en telt daar niet mee.
alter table public.projecten
  add column wachtkamer boolean not null default false,
  add column subfase text check (subfase in ('so', 'vo')),
  add column buddy text;
comment on column public.projecten.wachtkamer is 'Lead in de wachtkamer: nog niet actief, wel in beeld.';
comment on column public.projecten.subfase is 'Subfase van haalbaarheid: so (SO) of vo (ontwikkeling VO).';
comment on column public.projecten.buddy is 'Tweede persoon die meekijkt; telt niet mee in de bezetting.';

drop trigger projecten_log on public.projecten;
create trigger projecten_log after update on public.projecten for each row execute function public.log_wijziging(
  'fase', 'subfase', 'prio', 'wachtkamer', 'nummer', 'naam', 'postcode', 'huisnummer', 'straat', 'plaats', 'm2', 'soort', 'slagingskans',
  'am', 'po', 'pm', 'opzichter', 'buddy',
  'datum_casco', 'datum_voorbereiding', 'datum_inkoop', 'datum_afbouw', 'datum_oplevering',
  'prognose_casco', 'prognose_afbouw', 'prognose_oplevering',
  'sharepoint_url', 'extern_url', 'notitieblok_url', 'tekeningen_locatie');

-- Per project en discipline één leverancier, met een contactpersoon of telefoonnummer. De leverancier staat dan ook
-- op het project (voor Controle). Gaat hij van het project af, dan blijft de discipline leeg achter, met het contact.
create table public.project_disciplines (
  project_id uuid not null references public.projecten (id) on delete cascade,
  discipline text not null check (discipline in (
    'casco', 'sloop', 'w', 'e', 'klimaat', 'lift', 'zon', 'wanden', 'vloeren', 'kozijnen', 'schilder', 'sanitair', 'brand', 'terrein', 'overig')),
  leverancier_id uuid,
  contact text check (length(contact) <= 300),
  primary key (project_id, discipline),
  foreign key (project_id, leverancier_id) references public.project_leveranciers (project_id, leverancier_id) on delete set null (leverancier_id)
);
create index project_disciplines_leverancier on public.project_disciplines (leverancier_id);

alter table public.project_disciplines enable row level security;
create policy project_disciplines_lezen on public.project_disciplines for select to authenticated using (public.is_medewerker());
create policy project_disciplines_maken on public.project_disciplines for insert to authenticated with check (public.is_medewerker());
create policy project_disciplines_wijzigen on public.project_disciplines for update to authenticated using (public.is_medewerker()) with check (public.is_medewerker());
create policy project_disciplines_verwijderen on public.project_disciplines for delete to authenticated using (public.is_medewerker());

-- De actielijst van het overleg: per project genummerd in volgorde van aanmaken. Wie een actie maakte en wie hem
-- gereed meldde, vult de database in.
create table public.acties (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projecten (id) on delete cascade,
  tekst text not null default '' check (length(tekst) <= 2000),
  actiehouder text,
  deadline date,
  gereed boolean not null default false,
  gereed_door text,
  gereed_op timestamptz,
  aangemaakt_door text,
  aangemaakt_op timestamptz not null default now()
);
create index acties_project on public.acties (project_id, aangemaakt_op);

create or replace function public.actie_bijwerken() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.aangemaakt_door := public.wie();
    new.aangemaakt_op := now();
  else
    new.project_id := old.project_id;
    new.aangemaakt_door := old.aangemaakt_door;
    new.aangemaakt_op := old.aangemaakt_op;
  end if;
  if new.gereed then
    if tg_op = 'INSERT' or not old.gereed then
      new.gereed_door := public.wie();
      new.gereed_op := now();
    else
      new.gereed_door := old.gereed_door;
      new.gereed_op := old.gereed_op;
    end if;
  else
    new.gereed_door := null;
    new.gereed_op := null;
  end if;
  return new;
end $$;
create trigger acties_bijwerken before insert or update on public.acties for each row execute function public.actie_bijwerken();

alter table public.acties enable row level security;
create policy acties_lezen on public.acties for select to authenticated using (public.is_medewerker());
create policy acties_maken on public.acties for insert to authenticated with check (public.is_medewerker());
create policy acties_wijzigen on public.acties for update to authenticated using (public.is_medewerker()) with check (public.is_medewerker());
create policy acties_verwijderen on public.acties for delete to authenticated using (public.is_medewerker());

-- De e-mailadressen van actiehouders: één keer ingevuld, voor iedereen.
create table public.adressen (
  naam text primary key check (length(trim(naam)) between 1 and 120),
  email text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  gewijzigd_op timestamptz not null default now()
);
alter table public.adressen enable row level security;
create policy adressen_lezen on public.adressen for select to authenticated using (public.is_medewerker());
create policy adressen_maken on public.adressen for insert to authenticated with check (public.is_medewerker());
create policy adressen_wijzigen on public.adressen for update to authenticated using (public.is_medewerker()) with check (public.is_medewerker());

-- Live bijwerken: wijzigingen gaan via Supabase Realtime naar iedereen die de pagina open heeft (met de rechten
-- hierboven). Alleen waar de publicatie bestaat: in Supabase, niet in de tests op PGlite.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    alter publication supabase_realtime add table
      public.projecten, public.taken, public.opmerkingen, public.acties, public.controlepunten,
      public.project_leveranciers, public.project_disciplines, public.tekeningen;
  end if;
end $$;

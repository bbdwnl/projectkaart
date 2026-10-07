-- Projectkaart BBDW: schema, rechten (RLS) en logboek.
-- Inloggen gaat met Microsoft (Supabase Auth, provider "azure"). De browser praat
-- rechtstreeks met de database; wat iemand mag, staat hieronder in de policies.
-- Wie iets aftekent, een klantakkoord vastlegt of iets wijzigt, vullen de
-- triggers in: dat kan de browser niet vervalsen.

-- =========================================================
-- Wie mag erin
-- =========================================================

-- Pas deze lijst aan (in een nieuwe migratie) als er een tweede e-maildomein bij komt.
create or replace function public.toegestane_domeinen() returns text[]
language sql immutable as $$ select array['bbdw.nl'] $$;

create table public.profielen (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  naam text,
  rol text not null default 'medewerker' check (rol in ('medewerker', 'mt')),
  aangemaakt_op timestamptz not null default now()
);
comment on column public.profielen.rol is 'mt ziet de financiën en beheert de catalogus. Alleen te wijzigen via SQL.';

create or replace function public.is_medewerker() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'azure'
     and lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 2)) = any (public.toegestane_domeinen())
$$;

create or replace function public.is_mt() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_medewerker()
     and exists (select 1 from public.profielen where id = auth.uid() and rol = 'mt')
$$;

-- De naam in het logboek: de naam uit Microsoft, anders het e-mailadres.
create or replace function public.wie() returns text
language sql stable as $$
  select coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    nullif(auth.jwt() ->> 'email', ''),
    'systeem')
$$;

create or replace function public.nieuw_profiel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profielen (id, email, naam)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger nieuw_profiel after insert on auth.users
  for each row execute function public.nieuw_profiel();

-- =========================================================
-- Tabellen
-- =========================================================

create table public.projecten (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  nummer text unique,
  afas_nummer text unique,
  naam text not null,
  plaats text,
  adres text,
  fase text not null default 'lead' check (fase in ('lead', 'haalbaarheid', 'ontwikkeling', 'uitvoering', 'nazorg')),
  prio boolean not null default false,
  soort text[] not null default '{}' check (soort <@ array['adv', 'ont', 'tk']),
  m2 numeric,
  slagingskans integer check (slagingskans in (0, 25, 50, 75, 100)),
  am text,
  po text,
  pm text,
  opzichter text,
  datum_casco date,
  datum_voorbereiding date,
  datum_inkoop date,
  datum_afbouw date,
  datum_oplevering date,
  sharepoint_url text,
  extern_url text,
  notitieblok_url text,
  tekeningen_locatie text,
  aangemaakt_op timestamptz not null default now(),
  gewijzigd_op timestamptz not null default now(),
  gewijzigd_door text
);
comment on column public.projecten.nummer is 'Projectnummer, bijvoorbeeld P20038.';
comment on column public.projecten.afas_nummer is 'Het projectnummer in AFAS; de sleutel voor een latere koppeling.';

-- De gedeelde catalogus van uitzonderingen. Niet vrij typen per project, zodat te tellen is hoe vaak iets voorkomt.
create table public.uitzonderingen (
  id uuid primary key default gen_random_uuid(),
  titel text not null check (length(trim(titel)) between 2 and 160),
  fase text not null check (fase in ('lead', 'haalbaarheid', 'ontwikkeling', 'uitvoering', 'nazorg')),
  status text not null default 'uitzondering' check (status in ('uitzondering', 'voorgesteld', 'standaard')),
  aangemaakt_door text,
  aangemaakt_op timestamptz not null default now()
);
create unique index uitzonderingen_titel on public.uitzonderingen (lower(trim(titel)));

-- De stand van één taak in één project: een standaardtaak (lijst + sleutel uit app/lib/taken.ts) of een uitzondering.
create table public.taken (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projecten (id) on delete cascade,
  lijst text,
  sleutel text,
  uitzondering_id uuid references public.uitzonderingen (id),
  fase text not null check (fase in ('lead', 'haalbaarheid', 'ontwikkeling', 'uitvoering', 'nazorg')),
  deadline date,
  status text not null default 'niet_gestart' check (status in ('niet_gestart', 'loopt', 'concept', 'definitief', 'volgende_fase', 'nvt')),
  eigenaar text,
  notitie text,
  reden_nvt text,
  aanleiding text,
  klantakkoord boolean not null default false,
  klantakkoord_door text,
  klantakkoord_op timestamptz,
  document_url text check (document_url is null or document_url ~* '^https?://'),
  document_naam text,
  afgetekend_door text,
  afgetekend_op timestamptz,
  aangemaakt_op timestamptz not null default now(),
  gewijzigd_op timestamptz not null default now(),
  gewijzigd_door text,
  constraint taak_soort check (
    (lijst is not null and sleutel is not null and uitzondering_id is null and fase = lijst)
    or (lijst is null and sleutel is null and uitzondering_id is not null)
  ),
  constraint taken_standaard unique (project_id, lijst, sleutel),
  constraint taken_uitzondering unique (project_id, uitzondering_id)
);
create index taken_project on public.taken (project_id);

create table public.financien (
  project_id uuid primary key references public.projecten (id) on delete cascade,
  prognose_omzet_uren numeric,
  prognose_omzet_turnkey numeric,
  prognose_inkoop numeric,
  opdracht_uren numeric,
  opdracht_turnkey numeric,
  opdracht_inkoop_derden numeric,
  omzet_gefactureerd numeric,
  kosten_uren numeric,
  kosten_onderaanneming numeric,
  bm_werkelijk numeric,
  gewijzigd_op timestamptz not null default now(),
  gewijzigd_door text
);

create table public.logboek (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projecten (id) on delete cascade,
  op timestamptz not null default now(),
  door text not null,
  tabel text not null check (tabel in ('projecten', 'taken')),
  taak_id uuid,
  lijst text,
  sleutel text,
  uitzondering_id uuid,
  veld text not null,
  oud text,
  nieuw text
);
create index logboek_project on public.logboek (project_id, op desc);

-- =========================================================
-- Triggers
-- =========================================================

create or replace function public.zet_gewijzigd() returns trigger
language plpgsql as $$
begin
  new.gewijzigd_op := now();
  new.gewijzigd_door := public.wie();
  return new;
end $$;

create trigger projecten_gewijzigd before insert or update on public.projecten for each row execute function public.zet_gewijzigd();
create trigger taken_gewijzigd before insert or update on public.taken for each row execute function public.zet_gewijzigd();
create trigger financien_gewijzigd before insert or update on public.financien for each row execute function public.zet_gewijzigd();

-- Aftekenen en klantakkoord: wie en wanneer komt altijd van de database.
create or replace function public.taak_aftekenen() returns trigger
language plpgsql as $$
begin
  if new.status = 'definitief' then
    if tg_op = 'INSERT' or old.status is distinct from 'definitief' then
      new.afgetekend_door := public.wie();
      new.afgetekend_op := now();
    else
      new.afgetekend_door := old.afgetekend_door;
      new.afgetekend_op := old.afgetekend_op;
    end if;
  else
    new.afgetekend_door := null;
    new.afgetekend_op := null;
  end if;

  if new.klantakkoord then
    if tg_op = 'INSERT' or not old.klantakkoord then
      new.klantakkoord_door := public.wie();
      new.klantakkoord_op := now();
    else
      new.klantakkoord_door := old.klantakkoord_door;
      new.klantakkoord_op := old.klantakkoord_op;
    end if;
  else
    new.klantakkoord_door := null;
    new.klantakkoord_op := null;
  end if;
  return new;
end $$;

create trigger taken_aftekenen before insert or update on public.taken for each row execute function public.taak_aftekenen();

-- Het logboek. De gelogde velden staan als argumenten bij de trigger.
create or replace function public.log_wijziging() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  oud jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  nieuw jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  rij jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  pid uuid := coalesce((rij ->> 'project_id')::uuid, (rij ->> 'id')::uuid);
  taak uuid := case when tg_table_name = 'taken' then (rij ->> 'id')::uuid end;
  v text;
begin
  if tg_op in ('INSERT', 'DELETE') and rij ->> 'uitzondering_id' is not null then
    insert into public.logboek (project_id, door, tabel, taak_id, uitzondering_id, veld)
    values (pid, public.wie(), tg_table_name, taak, (rij ->> 'uitzondering_id')::uuid, case when tg_op = 'INSERT' then 'toegevoegd' else 'verwijderd' end);
  end if;
  if tg_op = 'DELETE' then return null; end if;

  foreach v in array tg_argv loop
    if (oud -> v) is distinct from (nieuw -> v)
       and not (tg_op = 'INSERT' and (nieuw -> v) in ('null'::jsonb, 'false'::jsonb, '"niet_gestart"'::jsonb)) then
      insert into public.logboek (project_id, door, tabel, taak_id, lijst, sleutel, uitzondering_id, veld, oud, nieuw)
      values (pid, public.wie(), tg_table_name, taak, rij ->> 'lijst', rij ->> 'sleutel', (rij ->> 'uitzondering_id')::uuid, v, oud ->> v, nieuw ->> v);
    end if;
  end loop;
  return null;
end $$;

create trigger projecten_log after update on public.projecten for each row execute function public.log_wijziging(
  'fase', 'prio', 'nummer', 'afas_nummer', 'naam', 'adres', 'm2', 'soort', 'am', 'po', 'pm', 'opzichter',
  'datum_casco', 'datum_voorbereiding', 'datum_inkoop', 'datum_afbouw', 'datum_oplevering',
  'sharepoint_url', 'extern_url', 'notitieblok_url', 'tekeningen_locatie');
create trigger taken_log after insert or update or delete on public.taken for each row execute function public.log_wijziging(
  'status', 'eigenaar', 'klantakkoord', 'document_url', 'document_naam', 'reden_nvt', 'deadline', 'notitie', 'aanleiding');

-- Een nieuwe uitzondering in de catalogus krijgt de naam van wie hem aanmaakt.
create or replace function public.zet_aangemaakt_door() returns trigger
language plpgsql as $$
begin
  new.aangemaakt_door := public.wie();
  return new;
end $$;
create trigger uitzonderingen_door before insert on public.uitzonderingen for each row execute function public.zet_aangemaakt_door();

-- =========================================================
-- Rechten (RLS)
-- =========================================================

alter table public.profielen enable row level security;
alter table public.projecten enable row level security;
alter table public.uitzonderingen enable row level security;
alter table public.taken enable row level security;
alter table public.financien enable row level security;
alter table public.logboek enable row level security;

create policy profielen_lezen on public.profielen for select to authenticated using (public.is_medewerker());
create policy profielen_eigen_naam on public.profielen for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profielen from authenticated;
grant update (naam) on public.profielen to authenticated;

create policy projecten_lezen on public.projecten for select to authenticated using (public.is_medewerker());
create policy projecten_maken on public.projecten for insert to authenticated with check (public.is_medewerker());
create policy projecten_wijzigen on public.projecten for update to authenticated using (public.is_medewerker()) with check (public.is_medewerker());
create policy projecten_verwijderen on public.projecten for delete to authenticated using (public.is_mt());

create policy uitzonderingen_lezen on public.uitzonderingen for select to authenticated using (public.is_medewerker());
create policy uitzonderingen_maken on public.uitzonderingen for insert to authenticated with check (public.is_medewerker() and status = 'uitzondering');
create policy uitzonderingen_beheren on public.uitzonderingen for update to authenticated using (public.is_mt()) with check (public.is_mt());

create policy taken_lezen on public.taken for select to authenticated using (public.is_medewerker());
create policy taken_maken on public.taken for insert to authenticated with check (public.is_medewerker());
create policy taken_wijzigen on public.taken for update to authenticated using (public.is_medewerker()) with check (public.is_medewerker());
create policy taken_verwijderen on public.taken for delete to authenticated using (public.is_medewerker() and uitzondering_id is not null);

create policy financien_mt on public.financien for all to authenticated using (public.is_mt()) with check (public.is_mt());

create policy logboek_lezen on public.logboek for select to authenticated using (public.is_medewerker());
-- Geen insert-policy: alleen de trigger (security definer) schrijft in het logboek.

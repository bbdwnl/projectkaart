-- De keuzelijsten van de app, aan te passen onder Instellingen (alleen het MT): wie welke rol kan hebben, de namen
-- van statussen en fasen, de soorten, subfasen en disciplines, het standaardpakket met taken en wat er bij elke
-- overdracht klaar moet zijn. Eén rij per lijst, de inhoud als JSON (de vorm staat in app/lib/instellingen.ts).
-- Zonder rij gelden de lijsten uit de code; een rij weghalen zet die lijst terug naar de standaard.
create table public.instellingen (
  sleutel text primary key check (sleutel in ('mensen', 'labels', 'takenpakket', 'overdracht')),
  waarde jsonb not null check (jsonb_typeof(waarde) = 'object' and length(waarde::text) <= 200000),
  gewijzigd_door text,
  gewijzigd_op timestamptz not null default now()
);

create or replace function public.instelling_bijwerken() returns trigger
language plpgsql set search_path = public as $$
begin
  new.gewijzigd_door := public.wie();
  new.gewijzigd_op := now();
  return new;
end $$;
create trigger instellingen_bijwerken before insert or update on public.instellingen
  for each row execute function public.instelling_bijwerken();

alter table public.instellingen enable row level security;
create policy instellingen_lezen on public.instellingen for select to authenticated using (public.is_medewerker());
create policy instellingen_maken on public.instellingen for insert to authenticated with check (public.is_mt());
create policy instellingen_wijzigen on public.instellingen for update to authenticated using (public.is_mt()) with check (public.is_mt());
create policy instellingen_verwijderen on public.instellingen for delete to authenticated using (public.is_mt());

-- Soorten, subfasen en disciplines zijn nu uit te breiden: de vaste lijst in de database maakt plaats voor een
-- korte code (kleine letters, cijfers en _). Wat weg is uit de lijst, blijft op het project staan.
alter table public.projecten drop constraint if exists projecten_soort_check;
alter table public.projecten drop constraint if exists projecten_subfase_check;
alter table public.projecten
  add constraint projecten_soort_code check (array_to_string(soort, ',') ~ '^([a-z0-9_]{1,40}(,[a-z0-9_]{1,40})*)?$'),
  add constraint projecten_subfase_code check (subfase ~ '^[a-z0-9_]{1,40}$');
alter table public.project_disciplines drop constraint if exists project_disciplines_discipline_check;
alter table public.project_disciplines add constraint project_disciplines_discipline_code check (discipline ~ '^[a-z0-9_]{1,40}$');

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    alter publication supabase_realtime add table public.instellingen;
  end if;
end $$;

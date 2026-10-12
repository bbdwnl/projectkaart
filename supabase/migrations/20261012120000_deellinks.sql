-- Deellinks: een leverancier ziet zonder account zijn open aandachtspunten op een eigen pagina (/punten/<token>),
-- met de foto's en de plek op de tekening. De pagina vraagt een code van vijf cijfers (2 tot en met 9).
-- Een link is een maand geldig en gaat dicht zodra alle punten van de leverancier zijn opgelost, als een medewerker
-- hem intrekt, of na tien verkeerde codes op rij. Dicht blijft dicht: daarna maak je een nieuwe link.
--
-- De pagina leest via de server met de service-rol (server/api/punten). Voor anonieme bezoekers is hier niets te lezen.

create table public.deellinks (
  id uuid primary key default gen_random_uuid(),
  leverancier_id uuid not null references public.leveranciers (id) on delete cascade,
  token text not null unique check (token ~ '^[0-9a-f]{64}$'),
  code text not null check (code ~ '^[2-9]{5}$'),
  geldig_tot timestamptz not null,
  gesloten_op timestamptz,
  gesloten_door text,
  gesloten_reden text check (gesloten_reden in ('opgelost', 'ingetrokken', 'geblokkeerd')),
  foute_pogingen integer not null default 0 check (foute_pogingen >= 0),
  bekeken_op timestamptz,
  aangemaakt_door text,
  aangemaakt_op timestamptz not null default now(),
  check ((gesloten_op is null) = (gesloten_reden is null))
);
create index deellinks_leverancier on public.deellinks (leverancier_id, aangemaakt_op desc);
comment on column public.deellinks.token is 'Het deel van de link dat niet te raden is: twee keer gen_random_uuid, 64 tekens.';
comment on column public.deellinks.code is 'Vijf cijfers van 2 tot en met 9. Apart doorgeven aan de leverancier.';

-- De server (service-rol): alleen die houdt bij wanneer de pagina is bekeken en hoe vaak de code fout was.
create or replace function public.is_server() returns boolean
language sql stable as $$
  select current_user = 'service_role' or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

-- Token, code en einddatum komen altijd van de database; de browser kan ze niet kiezen of oprekken.
create or replace function public.deellink_bijwerken() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.controlepunten where leverancier_id = new.leverancier_id and not opgelost) then
      raise exception 'Deze leverancier heeft geen open aandachtspunten.';
    end if;
    new.token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    -- De eerste vijf bytes van een uuid zijn willekeurig; 256 is deelbaar door 8, dus elk cijfer komt even vaak voor.
    new.code := (select string_agg((get_byte(b, i) % 8 + 2)::text, '' order by i)
                 from (select uuid_send(gen_random_uuid()) as b) u, generate_series(0, 4) as i);
    new.geldig_tot := now() + interval '1 month';
    new.gesloten_op := null;
    new.gesloten_door := null;
    new.gesloten_reden := null;
    new.foute_pogingen := 0;
    new.bekeken_op := null;
    new.aangemaakt_door := public.wie();
    new.aangemaakt_op := now();
    return new;
  end if;

  new.id := old.id;
  new.leverancier_id := old.leverancier_id;
  new.token := old.token;
  new.code := old.code;
  new.geldig_tot := old.geldig_tot;
  new.aangemaakt_door := old.aangemaakt_door;
  new.aangemaakt_op := old.aangemaakt_op;
  if old.gesloten_reden is not null then
    new.gesloten_op := old.gesloten_op;
    new.gesloten_door := old.gesloten_door;
    new.gesloten_reden := old.gesloten_reden;
  elsif new.gesloten_reden is not null then
    new.gesloten_op := now();
    new.gesloten_door := public.wie();
  else
    new.gesloten_op := null;
    new.gesloten_door := null;
  end if;
  if not public.is_server() then
    new.foute_pogingen := old.foute_pogingen;
    new.bekeken_op := old.bekeken_op;
  end if;
  return new;
end $$;

create trigger deellinks_bijwerken before insert or update on public.deellinks
  for each row execute function public.deellink_bijwerken();

-- Is het laatste open punt van een leverancier opgelost (of weg, of bij een ander), dan gaan zijn links dicht.
create or replace function public.deellinks_sluiten() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.leverancier_id is not null
     and not exists (select 1 from public.controlepunten where leverancier_id = old.leverancier_id and not opgelost) then
    update public.deellinks set gesloten_reden = 'opgelost'
    where leverancier_id = old.leverancier_id and gesloten_reden is null and geldig_tot > now();
  end if;
  return null;
end $$;

create trigger controlepunten_deellinks after update or delete on public.controlepunten
  for each row execute function public.deellinks_sluiten();

alter table public.deellinks enable row level security;
create policy deellinks_lezen on public.deellinks for select to authenticated using (public.is_medewerker());
create policy deellinks_maken on public.deellinks for insert to authenticated with check (public.is_medewerker());
create policy deellinks_wijzigen on public.deellinks for update to authenticated using (public.is_medewerker()) with check (public.is_medewerker());
-- Geen delete: een link gaat dicht, zodat te zien blijft wat er is gedeeld.

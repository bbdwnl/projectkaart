-- Beveiliging, na de security scan van 28-10-2026.

-- =========================================================
-- Geen wachtwoorden
-- =========================================================
-- Supabase Auth kent bij Email ook inloggen met een wachtwoord, en iedereen met de publieke sleutel kan een account
-- aanmaken voor een adres op het eigen domein, met een zelfgekozen wachtwoord. Bevestigt de echte eigenaar dat
-- account later met een inloglink, dan blijft dat wachtwoord staan. is_medewerker() laat zo'n inlog al niet toe
-- (alleen een link per mail telt, migratie inloglink); hier gaat ook het wachtwoord zelf weg, zodat inloggen met een
-- wachtwoord nergens meer werkt. Ook het tijdelijke wachtwoord dat Supabase zelf zet bij een nieuw account.
create or replace function public.geen_wachtwoord() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.encrypted_password := '';
  return new;
end $$;

create trigger geen_wachtwoord before insert or update of encrypted_password on auth.users
  for each row execute function public.geen_wachtwoord();
update auth.users set encrypted_password = '' where coalesce(encrypted_password, '') <> '';

-- =========================================================
-- Je naam: één keer, en niet die van een ander
-- =========================================================
-- Je naam staat bij alles wat je aftekent en wijzigt (wie()). Je kiest hem bij je eerste inlog; daarna past alleen
-- een beheerder hem aan (SQL), zodat niemand even onder andermans naam kan aftekenen en hem dan terugzet. Een naam
-- die een ander al heeft, kan niet. De naam in het token (user_metadata) telt niet meer: die zet iedereen zelf.

create or replace function public.wie() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(trim(naam), '') from public.profielen where id = auth.uid()),
    nullif(auth.jwt() ->> 'email', ''),
    'systeem')
$$;

create or replace function public.nieuw_profiel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profielen (id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;

-- Spaties netjes, en uniek zonder op hoofdletters te letten. Foutcode 23505 (al in gebruik): de app geeft dan een eigen melding.
create or replace function public.naam_uniek() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.naam := nullif(regexp_replace(trim(new.naam), '\s+', ' ', 'g'), '');
  if new.naam is not null and exists (select 1 from public.profielen where id <> new.id and lower(naam) = lower(new.naam)) then
    raise exception 'De naam % heeft al iemand anders.', new.naam using errcode = '23505';
  end if;
  return new;
end $$;

create trigger profielen_naam before insert or update of naam on public.profielen
  for each row execute function public.naam_uniek();

update public.profielen set naam = null where length(trim(naam)) < 2;
alter table public.profielen add constraint profielen_naam_lengte check (naam is null or length(naam) between 2 and 80);

drop policy profielen_eigen_naam on public.profielen;
create policy profielen_eigen_naam on public.profielen for update to authenticated
  using (id = auth.uid() and public.is_medewerker() and naam is null)
  with check (id = auth.uid());

-- =========================================================
-- Links op het project: alleen http(s)
-- =========================================================
-- Zoals document_url bij een taak. Een ander adres (javascript:) zou anders als link op de kaart staan.
update public.projecten set
  sharepoint_url = case when sharepoint_url ~* '^https?://' then sharepoint_url end,
  extern_url = case when extern_url ~* '^https?://' then extern_url end,
  notitieblok_url = case when notitieblok_url ~* '^https?://' then notitieblok_url end
where sharepoint_url !~* '^https?://' or extern_url !~* '^https?://' or notitieblok_url !~* '^https?://';

alter table public.projecten
  add constraint projecten_sharepoint_url check (sharepoint_url ~* '^https?://'),
  add constraint projecten_extern_url check (extern_url ~* '^https?://'),
  add constraint projecten_notitieblok_url check (notitieblok_url ~* '^https?://');

-- =========================================================
-- De code van een deellink: controleren en tellen in één keer
-- =========================================================
-- De server las eerst de link en schreef daarna het aantal verkeerde codes + 1 terug. Verzoeken tegelijk zagen zo
-- allemaal dezelfde stand, en de grens van tien pogingen hield niet. Nu in één transactie met de rij vast: na tien
-- verkeerde codes op rij gaat de link dicht (gelijk aan MAX_POGINGEN in app/lib/deellink.ts). Een dichte of
-- verlopen link telt niet. Alleen voor de server (service-rol).
-- Geeft de link daarna en of de code klopte; null als er geen link met dit token is.
create or replace function public.deellink_code(link_token text, poging text) returns jsonb
language plpgsql set search_path = public as $$
declare
  l public.deellinks;
  klopt boolean := false;
begin
  select * into l from public.deellinks where token = link_token for update;
  if not found then
    return null;
  end if;
  if l.gesloten_reden is null and l.geldig_tot > now() then
    klopt := coalesce(poging = l.code, false);
    update public.deellinks set
      foute_pogingen = case when klopt then 0 else foute_pogingen + 1 end,
      bekeken_op = case when klopt then now() else bekeken_op end,
      gesloten_reden = case when not klopt and foute_pogingen + 1 >= 10 then 'geblokkeerd' end
    where id = l.id
    returning * into l;
  end if;
  return jsonb_build_object('klopt', klopt, 'foute_pogingen', l.foute_pogingen, 'geldig_tot', l.geldig_tot,
    'gesloten_reden', l.gesloten_reden, 'gesloten_op', l.gesloten_op);
end $$;

revoke execute on function public.deellink_code(text, text) from public, anon, authenticated;
grant execute on function public.deellink_code(text, text) to service_role;

-- =========================================================
-- Een vaste search_path voor de overige functies (Supabase Security Advisor)
-- =========================================================
alter function public.toegestane_domeinen() set search_path = public;
alter function public.inlogduur() set search_path = public;
alter function public.is_server() set search_path = public;
alter function public.zet_gewijzigd() set search_path = public;
alter function public.taak_aftekenen() set search_path = public;
alter function public.zet_aangemaakt_door() set search_path = public;
alter function public.controlepunt_bijwerken() set search_path = public;
alter function public.deellink_bijwerken() set search_path = public;
alter function public.actie_bijwerken() set search_path = public;

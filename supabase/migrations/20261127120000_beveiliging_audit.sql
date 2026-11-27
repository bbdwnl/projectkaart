-- Beveiliging, na de security-audit van 26-11-2026 (beslissing 47).

-- =========================================================
-- Copilot: een programma mag pas koppelen als het MT het heeft goedgekeurd
-- =========================================================
-- Registreren (RFC 7591) staat open: zo werkt het protocol, en Copilot Studio en VS Code doen het zelf. Maar een
-- terugadres bij Microsoft (*.consent.azure-apim.net) is niet per se dat van BbDW: iemand met een eigen Power
-- Platform-omgeving kon een "Copilot" registreren, een collega via een link laten toestaan, en kreeg dan diens toegang.
-- Daarom keurt iemand van het MT een nieuw programma eerst goed: op /koppelen (als hij het zelf startte) of onder
-- Instellingen → Copilot. Zonder goedkeuring komt er geen autorisatiecode, dus ook geen token. Bestaande clients zijn
-- niet goedgekeurd: bij de volgende keer toestaan vraagt de app het MT.
alter table public.oauth_clients
  add column goedgekeurd_op timestamptz,
  add column goedgekeurd_door uuid references auth.users (id) on delete set null;
comment on column public.oauth_clients.goedgekeurd_op is 'Door het MT goedgekeurd (op /koppelen of onder Instellingen → Copilot). Zonder komt er geen code.';

-- Een registratie komt nooit al goedgekeurd binnen. Wat zich meldt en na een week niet is goedgekeurd, gaat weer weg
-- (als er geen koppeling aan hangt), zodat de lijst voor het MT niet volloopt.
create or replace function public.oauth_client_maken() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.oauth_clients where aangemaakt_op > now() - interval '1 hour') >= 100 then
    raise exception 'Te veel nieuwe clients; probeer het over een uur opnieuw.';
  end if;
  delete from public.oauth_clients c
  where c.goedgekeurd_op is null and c.aangemaakt_op < now() - interval '7 days'
    and not exists (select 1 from public.copilot_koppelingen k where k.client_id = c.id);
  new.aangemaakt_op := now();
  new.goedgekeurd_op := null;
  new.goedgekeurd_door := null;
  return new;
end $$;

-- Goedkeuren kan alleen iemand van het MT (de server schrijft wie; de database controleert het). Het moment komt van
-- de database. Valt de goedkeurder later weg (on delete set null), dan blijft de goedkeuring staan.
create or replace function public.oauth_client_goedkeuren() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.goedgekeurd_op is not null and new.goedgekeurd_op is distinct from old.goedgekeurd_op then
    if new.goedgekeurd_door is null or not exists (select 1 from public.profielen where id = new.goedgekeurd_door and rol = 'mt') then
      raise exception 'Alleen iemand van het MT keurt een programma goed.';
    end if;
    new.goedgekeurd_op := now();
  end if;
  return new;
end $$;
create trigger oauth_clients_goedkeuren before update on public.oauth_clients
  for each row execute function public.oauth_client_goedkeuren();

-- Geen code (en dus geen token) voor een programma dat niet is goedgekeurd, wat de server ook meestuurt.
create or replace function public.oauth_code_maken() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.oauth_clients where id = new.client_id and goedgekeurd_op is not null) then
    raise exception 'Dit programma is nog niet goedgekeurd door het MT.';
  end if;
  -- Oude codes opruimen: die zijn toch niet meer te gebruiken.
  delete from public.oauth_codes where verloopt_op < now() - interval '1 hour';
  new.aangemaakt_op := now();
  new.verloopt_op := now() + interval '5 minutes';
  return new;
end $$;

-- =========================================================
-- Hulpfuncties niet voor wie niet is ingelogd
-- =========================================================
-- PostgREST stelt elke functie in public open voor de rol anon (/rest/v1/rpc/…). Deze functies zijn er voor RLS en de
-- triggers; wie niet is ingelogd heeft er niets te vragen, en toegestane_domeinen() zou het domein verraden. De
-- policies gelden alleen voor authenticated, dus anon komt ze nergens tegen. (deellink_code en ik_ben_actief waren al dicht.)
revoke execute on function
  public.toegestane_domeinen(), public.inlogduur(), public.is_medewerker(), public.is_mt(), public.wie(),
  public.is_server(), public.sessie_uit_token(), public.copilot_stilte(), public.copilot_hoogstens()
from public, anon;
grant execute on function
  public.toegestane_domeinen(), public.inlogduur(), public.is_medewerker(), public.is_mt(), public.wie(),
  public.is_server(), public.sessie_uit_token(), public.copilot_stilte(), public.copilot_hoogstens()
to authenticated, service_role;

-- =========================================================
-- De melding bij een vreemd adres noemt het domein niet
-- =========================================================
-- Dezelfde tekst als in de app (FOUT_ADRES in app/lib/inlog.ts): wie een link aanvraagt voor een adres buiten het eigen
-- domein, hoort niet welk domein wel mag.
create or replace function public.alleen_eigen_domein() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(split_part(coalesce(new.email, ''), '@', 2)) <> all (public.toegestane_domeinen()) then
    raise exception 'Foutief of onbekend e-mailadres.';
  end if;
  return new;
end $$;

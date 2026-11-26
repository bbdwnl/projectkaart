-- Copilot (MCP, beslissing 46): Microsoft 365 Copilot, Copilot Studio of VS Code koppelt zich met OAuth aan de
-- projectkaart, namens één medewerker. Copilot krijgt geen eigen rechten: na Toestaan logt de server in voor die
-- medewerker (zoals een link per mail doet), dus RLS, wie() en het logboek gelden zoals in de app. Een koppeling geldt
-- een week, net als een inlog (inlogduur()); daarna vraagt Copilot opnieuw om in te loggen.
--
-- Alleen de server (service-rol) leest en schrijft deze tabellen. Van tokens en geheimen bewaart de database alleen een
-- hash; de sessie van de medewerker staat versleuteld met een geheim dat alleen op de server staat
-- (NUXT_COPILOT_GEHEIM). Niet in de back-up (server/utils/backup.ts).

-- Een eerdere versie van deze koppeling (sleutels om te plakken) is nooit in gebruik geweest.
drop table if exists public.copilot_sleutels;
drop function if exists public.copilot_sleutel_bijwerken();

-- =========================================================
-- Clients: wie zich registreert (RFC 7591), zoals Copilot Studio of VS Code
-- =========================================================
create table public.oauth_clients (
  id text primary key check (id ~ '^pkc_[A-Za-z0-9_-]{43}$'),
  naam text not null check (length(naam) between 1 and 120),
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 10),
  -- Null: een publieke client (VS Code), die zich met PKCE alleen bewijst.
  geheim_hash text check (geheim_hash ~ '^[0-9a-f]{64}$'),
  aangemaakt_op timestamptz not null default now()
);
comment on table public.oauth_clients is 'Copilot-clients (RFC 7591). De redirect-URI''s controleert de server (server/mcp/oauth.ts, redirectSoort).';

-- Iedereen kan zich registreren (zo werkt het protocol); toegang krijgt een client pas als een medewerker toestaat.
-- Om de tabel niet vol te laten lopen: hoogstens 100 nieuwe per uur.
create or replace function public.oauth_client_maken() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.oauth_clients where aangemaakt_op > now() - interval '1 hour') >= 100 then
    raise exception 'Te veel nieuwe clients; probeer het over een uur opnieuw.';
  end if;
  new.aangemaakt_op := now();
  return new;
end $$;
create trigger oauth_clients_maken before insert on public.oauth_clients for each row execute function public.oauth_client_maken();

-- =========================================================
-- Autorisatiecodes: tussen Toestaan en het eerste token, vijf minuten, één keer te gebruiken
-- =========================================================
create table public.oauth_codes (
  hash text primary key check (hash ~ '^[0-9a-f]{64}$'),
  client_id text not null references public.oauth_clients (id) on delete cascade,
  gebruiker_id uuid not null references auth.users (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null check (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  verloopt_op timestamptz not null,
  aangemaakt_op timestamptz not null default now()
);

create or replace function public.oauth_code_maken() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Oude codes opruimen: die zijn toch niet meer te gebruiken.
  delete from public.oauth_codes where verloopt_op < now() - interval '1 hour';
  new.aangemaakt_op := now();
  new.verloopt_op := now() + interval '5 minutes';
  return new;
end $$;
create trigger oauth_codes_maken before insert on public.oauth_codes for each row execute function public.oauth_code_maken();

-- =========================================================
-- Koppelingen: Copilot namens één medewerker
-- =========================================================
create table public.copilot_koppelingen (
  id uuid primary key default gen_random_uuid(),
  gebruiker_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null references public.oauth_clients (id) on delete cascade,
  -- De sessie van de medewerker in Supabase: het verversingstoken en het access token, versleuteld.
  sessie text,
  toegang text,
  -- Wat Copilot heeft: een access token (een uur) en een refresh token (tot geldig_tot), alleen als hash.
  toegang_hash text unique check (toegang_hash ~ '^[0-9a-f]{64}$'),
  toegang_tot timestamptz,
  ververs_hash text unique check (ververs_hash ~ '^[0-9a-f]{64}$'),
  geldig_tot timestamptz not null,
  ingetrokken_op timestamptz,
  laatst_gebruikt_op timestamptz,
  aangemaakt_op timestamptz not null default now()
);
create index copilot_koppelingen_gebruiker on public.copilot_koppelingen (gebruiker_id, aangemaakt_op desc);

-- Wanneer en hoe lang komen van de database. Na intrekken gaan sessie en tokens weg, en dat blijft zo.
create or replace function public.copilot_koppeling_bijwerken() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.copilot_koppelingen
        where gebruiker_id = new.gebruiker_id and ingetrokken_op is null and geldig_tot > now()) >= 10 then
      raise exception 'Je hebt al tien koppelingen met Copilot. Trek er eerst een in (Instellingen → Copilot).';
    end if;
    new.aangemaakt_op := now();
    new.geldig_tot := now() + public.inlogduur();
    new.ingetrokken_op := null;
    new.laatst_gebruikt_op := now();
    return new;
  end if;

  new.id := old.id;
  new.gebruiker_id := old.gebruiker_id;
  new.client_id := old.client_id;
  new.geldig_tot := old.geldig_tot;
  new.aangemaakt_op := old.aangemaakt_op;
  if old.ingetrokken_op is not null then
    new.ingetrokken_op := old.ingetrokken_op;
  end if;
  if new.ingetrokken_op is not null then
    new.sessie := null;
    new.toegang := null;
    new.toegang_hash := null;
    new.toegang_tot := null;
    new.ververs_hash := null;
  end if;
  return new;
end $$;
create trigger copilot_koppelingen_bijwerken before insert or update on public.copilot_koppelingen
  for each row execute function public.copilot_koppeling_bijwerken();

-- =========================================================
-- Rechten: geen policies, voor de browser is hier niets te lezen of te schrijven. De server gebruikt de service-rol.
-- =========================================================
alter table public.oauth_clients enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.copilot_koppelingen enable row level security;
revoke all on public.oauth_clients, public.oauth_codes, public.copilot_koppelingen from anon, authenticated;

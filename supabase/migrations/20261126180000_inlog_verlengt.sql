-- Een inlog blijft geldig zolang je de app gebruikt (keuze 26-11-2026, beslissing 34 aangepast). Na 30 dagen zonder
-- gebruik ben je uitgelogd en vraag je een nieuwe link aan. Eerst gold: een week vanaf het inloggen, gebruik verlengt niet.
--
-- De app meldt zich bij gebruik (ik_ben_actief(), bij het openen en daarna hoogstens elk kwartier); de database houdt per
-- sessie (de claim session_id in het token) bij wanneer die voor het laatst gebruikt is. is_medewerker() telt het
-- laatste moment: inloggen of gebruik. Een sessie die al verlopen is, kan zichzelf niet meer oprekken. Inloggen met een
-- wachtwoord geeft nog steeds geen toegang (de methode in amr, migratie alleen_inloglink).

-- Zo lang mag je de app niet gebruiken voordat je inlog verloopt. Gelijk aan INLOGDUUR_DAGEN in app/lib/inlog.ts.
create or replace function public.inlogduur() returns interval
language sql immutable set search_path = public as $$ select interval '30 days' $$;

-- Het laatste gebruik per sessie. Alleen via ik_ben_actief(); voor de browser verder niet te lezen of te schrijven.
create table public.sessies (
  sessie_id uuid primary key,
  gebruiker_id uuid not null references auth.users (id) on delete cascade,
  laatst_op timestamptz not null default now()
);
create index sessies_laatst on public.sessies (laatst_op);
alter table public.sessies enable row level security;
revoke all on public.sessies from anon, authenticated;

-- De sessie in het token, of null als er geen (geldige) is.
create or replace function public.sessie_uit_token() returns uuid
language sql stable set search_path = public as $$
  select case when coalesce(auth.jwt() ->> 'session_id', '') ~ '^[0-9a-f-]{36}$' then (auth.jwt() ->> 'session_id')::uuid end
$$;

create or replace function public.is_medewerker() returns boolean
language sql stable security definer set search_path = public as $$
  select lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 2)) = any (public.toegestane_domeinen())
     and (
       -- Ingelogd met een link of code, en dat (of het laatste gebruik van deze sessie) is minder dan inlogduur() geleden.
       coalesce((
         select greatest(min((a ->> 'timestamp')::double precision), (
           select extract(epoch from s.laatst_op) from public.sessies s
           where s.sessie_id = public.sessie_uit_token() and s.gebruiker_id = auth.uid()))
         from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
         where jsonb_typeof(a -> 'timestamp') = 'number'
           and a ->> 'method' in ('otp', 'magiclink', 'email/signup', 'invite')
         having count(*) > 0
       ) > extract(epoch from now() - public.inlogduur()), false)
       -- De sessie van een geldige koppeling met Copilot van deze persoon (migratie copilot_geldigheid).
       or exists (
         select 1 from public.copilot_koppelingen k
         where k.sessie_id = public.sessie_uit_token()
           and k.gebruiker_id = auth.uid()
           and k.ingetrokken_op is null
           and k.geldig_tot > now()
       )
     )
$$;

-- De app meldt: deze sessie wordt gebruikt. Alleen een sessie die nu nog geldt; geeft terug tot wanneer hij geldt
-- zonder verder gebruik, of null (dan is de inlog verlopen, of is er geen sessie in het token).
create or replace function public.ik_ben_actief() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  sid uuid := public.sessie_uit_token();
begin
  if sid is null or not public.is_medewerker() then
    return null;
  end if;
  insert into public.sessies (sessie_id, gebruiker_id, laatst_op) values (sid, auth.uid(), now())
  on conflict (sessie_id) do update set laatst_op = now() where public.sessies.gebruiker_id = excluded.gebruiker_id;
  -- Opruimen: wat al lang verlopen is, telt toch niet meer.
  delete from public.sessies where laatst_op < now() - 2 * public.inlogduur();
  return now() + public.inlogduur();
end $$;

revoke execute on function public.ik_ben_actief() from public, anon;
grant execute on function public.ik_ben_actief() to authenticated;

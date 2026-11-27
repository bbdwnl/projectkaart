-- Copilot: een koppeling blijft werken zolang hij gebruikt wordt (keuze 26-11-2026, beslissing 46). Elke keer dat
-- Copilot de projectkaart gebruikt, schuift het einde op naar 30 dagen later; na een jaar is het altijd klaar.
-- Inloggen in de browser blijft een week (inlogduur(), beslissing 34): dit geldt alleen voor de sessie achter een
-- koppeling, die alleen de server heeft.
--
-- De database dwingt het af: is_medewerker() laat een sessie ouder dan een week toe als het de sessie van een geldige,
-- niet ingetrokken koppeling van dezelfde persoon is (de claim session_id in het token). Ontkoppelen of het account
-- weghalen stopt hem dus meteen, ook als iemand het token van Supabase zelf zou hebben.

-- Zo lang zonder gebruik, en zo lang hoogstens. Gelijk aan de teksten in de app (Instellingen → Copilot, /koppelen).
create or replace function public.copilot_stilte() returns interval
language sql immutable set search_path = public as $$ select interval '30 days' $$;
create or replace function public.copilot_hoogstens() returns interval
language sql immutable set search_path = public as $$ select interval '1 year' $$;

-- De sessie in Supabase achter de koppeling (claim session_id), gezet door de server bij het toestaan.
alter table public.copilot_koppelingen add column sessie_id uuid unique;

-- Een koppeling die er al was, geldt vanaf nu ook zo.
update public.copilot_koppelingen
set geldig_tot = least(aangemaakt_op + public.copilot_hoogstens(), coalesce(laatst_gebruikt_op, aangemaakt_op) + public.copilot_stilte())
where ingetrokken_op is null;

create or replace function public.copilot_koppeling_bijwerken() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.copilot_koppelingen
        where gebruiker_id = new.gebruiker_id and ingetrokken_op is null and geldig_tot > now()) >= 10 then
      raise exception 'Je hebt al tien koppelingen met Copilot. Trek er eerst een in (Instellingen → Copilot).';
    end if;
    new.aangemaakt_op := now();
    new.laatst_gebruikt_op := now();
    new.geldig_tot := now() + least(public.copilot_stilte(), public.copilot_hoogstens());
    new.ingetrokken_op := null;
    return new;
  end if;

  new.id := old.id;
  new.gebruiker_id := old.gebruiker_id;
  new.client_id := old.client_id;
  new.aangemaakt_op := old.aangemaakt_op;
  new.sessie_id := coalesce(old.sessie_id, new.sessie_id);
  -- Gebruik verlengt: hoogstens tot nu (niet vooruit), en nooit voorbij een jaar na toestaan. Verlopen blijft verlopen.
  new.laatst_gebruikt_op := least(coalesce(new.laatst_gebruikt_op, old.laatst_gebruikt_op), now());
  new.geldig_tot := case
    when old.geldig_tot <= now() then old.geldig_tot
    else greatest(old.geldig_tot, least(old.aangemaakt_op + public.copilot_hoogstens(), new.laatst_gebruikt_op + public.copilot_stilte()))
  end;
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

-- Medewerker: zoals in de migratie alleen_inloglink (eigen domein, ingelogd met een link of code, binnen de week), óf
-- de sessie van een geldige koppeling met Copilot van deze persoon.
create or replace function public.is_medewerker() returns boolean
language sql stable security definer set search_path = public as $$
  select lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 2)) = any (public.toegestane_domeinen())
     and (
       coalesce((
         select min((a ->> 'timestamp')::double precision)
         from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
         where jsonb_typeof(a -> 'timestamp') = 'number'
           and a ->> 'method' in ('otp', 'magiclink', 'email/signup', 'invite')
       ) > extract(epoch from now() - public.inlogduur()), false)
       or exists (
         select 1 from public.copilot_koppelingen k
         where k.sessie_id = case when coalesce(auth.jwt() ->> 'session_id', '') ~ '^[0-9a-f-]{36}$' then (auth.jwt() ->> 'session_id')::uuid end
           and k.gebruiker_id = auth.uid()
           and k.ingetrokken_op is null
           and k.geldig_tot > now()
       )
     )
$$;

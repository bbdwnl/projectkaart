-- Inloggen met een link per mail (Supabase, magic link) in plaats van Microsoft.
-- Alleen adressen op toegestane_domeinen() krijgen een account, en een inlog geldt een week.

-- Zo lang geldt een inlog, vanaf het moment van inloggen; gebruik verlengt hem niet. Gelijk aan INLOGDUUR_DAGEN in app/lib/inlog.ts.
create or replace function public.inlogduur() returns interval
language sql immutable as $$ select interval '7 days' $$;

-- Medewerker: een adres op het eigen domein, en ingelogd binnen de inlogduur. Het moment van inloggen staat in
-- de claim amr van het token ([{method, timestamp}]); een ververst token houdt dat moment. Geen amr = geen toegang.
-- De link bewijst dat het adres van jou is; welke provider het token gaf, doet er niet meer toe.
create or replace function public.is_medewerker() returns boolean
language sql stable security definer set search_path = public as $$
  select lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 2)) = any (public.toegestane_domeinen())
     and coalesce((
       select min((a ->> 'timestamp')::double precision)
       from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
       where jsonb_typeof(a -> 'timestamp') = 'number'
     ) > extract(epoch from now() - public.inlogduur()), false)
$$;

-- Een account buiten het eigen domein komt er niet: zo stuurt Supabase ook geen link naar een vreemd adres.
create or replace function public.alleen_eigen_domein() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(split_part(coalesce(new.email, ''), '@', 2)) <> all (public.toegestane_domeinen()) then
    raise exception 'Alleen e-mailadressen van % kunnen inloggen.', array_to_string(public.toegestane_domeinen(), ', ');
  end if;
  return new;
end $$;

create trigger alleen_eigen_domein before insert or update of email on auth.users
  for each row execute function public.alleen_eigen_domein();

-- De naam in het logboek en bij aftekenen: de naam die je bij je eerste inlog opgaf (profielen.naam). Een link per
-- mail geeft geen naam mee zoals Microsoft deed; daarna de naam uit het token, dan het e-mailadres.
create or replace function public.wie() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(trim(naam), '') from public.profielen where id = auth.uid()),
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    nullif(auth.jwt() ->> 'email', ''),
    'systeem')
$$;

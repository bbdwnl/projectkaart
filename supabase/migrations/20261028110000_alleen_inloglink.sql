-- Alleen een inlog met een link per mail geeft toegang, niet met een wachtwoord. Anders kan iemand vooraf een
-- account met een eigen wachtwoord aanmaken op het adres van een collega die nog nooit inlogde (Supabase laat
-- signup met wachtwoord toe); bevestigt die collega het later met zijn link, dan blijft dat wachtwoord staan en komt
-- de aanvaller ermee binnen. De methodes in amr: otp (onze mail met token_hash), magiclink en email/signup (de
-- standaardmail van Supabase), invite. Gelijk aan INLOG_METHODEN in app/lib/inlog.ts.
create or replace function public.is_medewerker() returns boolean
language sql stable security definer set search_path = public as $$
  select lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 2)) = any (public.toegestane_domeinen())
     and coalesce((
       select min((a ->> 'timestamp')::double precision)
       from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
       where jsonb_typeof(a -> 'timestamp') = 'number'
         and a ->> 'method' in ('otp', 'magiclink', 'email/signup', 'invite')
     ) > extract(epoch from now() - public.inlogduur()), false)
$$;

-- Feedback uit de app: de knop rechtsonder. Een notitie, de pagina en eventueel de plek waar het over gaat.
-- Iedere medewerker kan feedback sturen; alleen het MT leest hem (in Supabase, tabel feedback). Wie en wanneer vult
-- de database in.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  tekst text not null check (length(trim(tekst)) between 1 and 4000),
  -- Het pad in de app, met de keuzes in de adresbalk (bijvoorbeeld /projecten/vlijtseweg?weergave=planning).
  pad text not null check (length(pad) <= 500),
  -- De gemarkeerde plek, in pixels vanaf de linkerbovenhoek van de pagina; leeg als er geen plek is gemarkeerd.
  plek_x integer check (plek_x >= 0),
  plek_y integer check (plek_y >= 0),
  -- Wat daar staat: het element en een stukje tekst, om de plek terug te vinden.
  element text check (length(element) <= 500),
  scherm_breedte integer check (scherm_breedte > 0),
  scherm_hoogte integer check (scherm_hoogte > 0),
  browser text check (length(browser) <= 500),
  afgehandeld boolean not null default false,
  door text,
  op timestamptz not null default now(),
  constraint feedback_plek_compleet check ((plek_x is null) = (plek_y is null))
);
create index feedback_op on public.feedback (op desc);

create or replace function public.feedback_door() returns trigger
language plpgsql set search_path = public as $$
begin
  new.door := public.wie();
  new.op := now();
  new.afgehandeld := false;
  return new;
end $$;
create trigger feedback_door before insert on public.feedback for each row execute function public.feedback_door();

alter table public.feedback enable row level security;
create policy feedback_sturen on public.feedback for insert to authenticated with check (public.is_medewerker());
create policy feedback_lezen on public.feedback for select to authenticated using (public.is_mt());
create policy feedback_afhandelen on public.feedback for update to authenticated using (public.is_mt()) with check (public.is_mt());

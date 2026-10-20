-- Opmerkingen bij een taak, in plaats van één notitie: een draad met per opmerking wie, wanneer en de tekst.
-- Wie en wanneer vult de database in. Een opmerking is daarna niet meer te wijzigen; elke opmerking komt in het logboek.

create table public.opmerkingen (
  id uuid primary key default gen_random_uuid(),
  taak_id uuid not null references public.taken (id) on delete cascade,
  project_id uuid not null references public.projecten (id) on delete cascade,
  tekst text not null check (length(trim(tekst)) between 1 and 4000),
  door text not null,
  op timestamptz not null default now()
);
create index opmerkingen_project on public.opmerkingen (project_id, op);

-- De notities die er al waren, worden de eerste opmerking: van wie de taak het laatst wijzigde, op dat moment.
insert into public.opmerkingen (taak_id, project_id, tekst, door, op)
  select id, project_id, trim(notitie), coalesce(gewijzigd_door, 'onbekend'), coalesce(gewijzigd_op, now())
  from public.taken where nullif(trim(notitie), '') is not null;

drop trigger taken_log on public.taken;
alter table public.taken drop column notitie;
create trigger taken_log after insert or update or delete on public.taken for each row execute function public.log_wijziging(
  'status', 'eigenaar', 'klantakkoord', 'document_url', 'document_naam', 'reden_nvt', 'deadline', 'aanleiding');

-- Project, wie en wanneer komen van de database, niet uit de browser. Security definer: alleen zo mag er in het logboek.
create or replace function public.opmerking_maken() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t public.taken;
begin
  select * into t from public.taken where id = new.taak_id;
  new.project_id := t.project_id;
  new.door := public.wie();
  new.op := now();
  insert into public.logboek (project_id, door, tabel, taak_id, lijst, sleutel, uitzondering_id, veld, nieuw)
  values (t.project_id, new.door, 'taken', t.id, t.lijst, t.sleutel, t.uitzondering_id, 'opmerking', new.tekst);
  return new;
end $$;

create trigger opmerkingen_maken before insert on public.opmerkingen for each row execute function public.opmerking_maken();

alter table public.opmerkingen enable row level security;
create policy opmerkingen_lezen on public.opmerkingen for select to authenticated using (public.is_medewerker());
create policy opmerkingen_maken on public.opmerkingen for insert to authenticated with check (public.is_medewerker());
-- Geen update- of delete-policy: wat er staat, blijft staan.

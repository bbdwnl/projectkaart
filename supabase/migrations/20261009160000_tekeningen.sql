-- Tekeningen: per project pdf's (plattegronden, gevels), en per aandachtspunt de plek op een tekening.
-- De plek is een blad (pagina) en x en y van 0 tot 1 op dat blad, los van zoom en schermgrootte.

create table public.tekeningen (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projecten (id) on delete cascade,
  naam text not null check (length(trim(naam)) between 1 and 160),
  pad text not null check (pad like project_id::text || '/%'),
  aangemaakt_door text,
  aangemaakt_op timestamptz not null default now(),
  -- Zodat een aandachtspunt alleen een tekening van zijn eigen project kan gebruiken.
  unique (id, project_id)
);
create index tekeningen_project on public.tekeningen (project_id, aangemaakt_op);
comment on column public.tekeningen.pad is 'Pad in de storage-bucket tekeningen: <project_id>/<naam>.pdf.';
create trigger tekeningen_door before insert on public.tekeningen for each row execute function public.zet_aangemaakt_door();

alter table public.controlepunten
  add column tekening_id uuid,
  add column tekening_blad integer check (tekening_blad >= 1),
  add column tekening_x double precision check (tekening_x between 0 and 1),
  add column tekening_y double precision check (tekening_y between 0 and 1),
  -- Een tekening met aandachtspunten erop kan niet weg: eerst de punten (of hun plek).
  add constraint controlepunten_tekening_op_project foreign key (tekening_id, project_id) references public.tekeningen (id, project_id),
  add constraint controlepunten_plek_compleet check (
    (tekening_id is null and tekening_blad is null and tekening_x is null and tekening_y is null)
    or (tekening_id is not null and tekening_blad is not null and tekening_x is not null and tekening_y is not null)
  );

alter table public.tekeningen enable row level security;
create policy tekeningen_lezen on public.tekeningen for select to authenticated using (public.is_medewerker());
create policy tekeningen_maken on public.tekeningen for insert to authenticated with check (public.is_medewerker());
create policy tekeningen_wijzigen on public.tekeningen for update to authenticated using (public.is_medewerker()) with check (public.is_medewerker());
create policy tekeningen_verwijderen on public.tekeningen for delete to authenticated using (public.is_medewerker());

-- De pdf's: besloten, alleen pdf, tot 50 MB (een A0-tekening kan groot zijn), alleen voor medewerkers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tekeningen', 'tekeningen', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy tekening_pdfs_lezen on storage.objects for select to authenticated
  using (bucket_id = 'tekeningen' and public.is_medewerker());
create policy tekening_pdfs_uploaden on storage.objects for insert to authenticated
  with check (bucket_id = 'tekeningen' and public.is_medewerker());
create policy tekening_pdfs_verwijderen on storage.objects for delete to authenticated
  using (bucket_id = 'tekeningen' and public.is_medewerker());

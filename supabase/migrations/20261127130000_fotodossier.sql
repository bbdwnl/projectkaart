-- Fotodossier: foto's per project, elk met een titel als je die opgeeft (beslissing 50). Zoals Controle, maar zonder
-- notitie, leverancier, stand of plek op een tekening: alleen vastleggen hoe iets eruitzag. De foto's staan in de
-- besloten bucket "fotodossier", in een map per project: <project_id>/<naam>.jpg.

create table public.dossierfotos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projecten (id) on delete cascade,
  titel text check (titel is null or length(titel) between 1 and 200),
  foto text not null,
  aangemaakt_door text,
  aangemaakt_op timestamptz not null default now(),
  check (foto like project_id::text || '/%')
);
create index dossierfotos_project on public.dossierfotos (project_id, aangemaakt_op desc);
comment on column public.dossierfotos.foto is 'Pad in de storage-bucket fotodossier: <project_id>/<naam>.jpg.';
comment on column public.dossierfotos.titel is 'Optioneel; een lege titel wordt null.';

-- Wie de foto maakte en wanneer vult de database in. Foto, project en maker liggen daarna vast; alleen de titel verandert.
create or replace function public.dossierfoto_bijwerken() returns trigger
language plpgsql set search_path = public as $$
begin
  new.titel := nullif(trim(new.titel), '');
  if tg_op = 'INSERT' then
    new.aangemaakt_door := public.wie();
    new.aangemaakt_op := now();
  else
    new.project_id := old.project_id;
    new.foto := old.foto;
    new.aangemaakt_door := old.aangemaakt_door;
    new.aangemaakt_op := old.aangemaakt_op;
  end if;
  return new;
end $$;

create trigger dossierfotos_bijwerken before insert or update on public.dossierfotos
  for each row execute function public.dossierfoto_bijwerken();

alter table public.dossierfotos enable row level security;
create policy dossierfotos_lezen on public.dossierfotos for select to authenticated using (public.is_medewerker());
create policy dossierfotos_maken on public.dossierfotos for insert to authenticated with check (public.is_medewerker());
create policy dossierfotos_wijzigen on public.dossierfotos for update to authenticated using (public.is_medewerker()) with check (public.is_medewerker());
create policy dossierfotos_verwijderen on public.dossierfotos for delete to authenticated using (public.is_medewerker());

-- De foto's: besloten, alleen afbeeldingen tot 10 MB, alleen voor medewerkers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotodossier', 'fotodossier', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy fotodossier_lezen on storage.objects for select to authenticated
  using (bucket_id = 'fotodossier' and public.is_medewerker());
create policy fotodossier_uploaden on storage.objects for insert to authenticated
  with check (bucket_id = 'fotodossier' and public.is_medewerker());
create policy fotodossier_verwijderen on storage.objects for delete to authenticated
  using (bucket_id = 'fotodossier' and public.is_medewerker());

-- Live bijwerken, zoals de andere tabellen van de kaart. Alleen waar de publicatie bestaat (niet in de tests op PGlite).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    alter publication supabase_realtime add table public.dossierfotos;
  end if;
end $$;

-- Controle: aandachtspunten per project, elk met een foto, een notitie en een leverancier.
-- De leveranciers stel je per project in onder Details. Foto's staan in de besloten bucket "controle",
-- in een map per project: <project_id>/<naam>.jpg.

create table public.leveranciers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projecten (id) on delete cascade,
  naam text not null check (length(trim(naam)) between 2 and 120),
  vak text,
  aangemaakt_op timestamptz not null default now(),
  -- Zodat een aandachtspunt alleen een leverancier van zijn eigen project kan kiezen.
  unique (id, project_id)
);
create unique index leveranciers_naam on public.leveranciers (project_id, lower(trim(naam)));

create table public.controlepunten (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projecten (id) on delete cascade,
  leverancier_id uuid not null,
  notitie text not null check (length(trim(notitie)) >= 2),
  foto text not null,
  opgelost boolean not null default false,
  opgelost_door text,
  opgelost_op timestamptz,
  aangemaakt_door text,
  aangemaakt_op timestamptz not null default now(),
  -- Een leverancier met aandachtspunten kan niet weg: eerst de punten.
  foreign key (leverancier_id, project_id) references public.leveranciers (id, project_id),
  check (foto like project_id::text || '/%')
);
create index controlepunten_project on public.controlepunten (project_id, aangemaakt_op desc);
comment on column public.controlepunten.foto is 'Pad in de storage-bucket controle: <project_id>/<naam>.jpg.';

-- Wie een punt maakt en wie het oplost, vult de database in. Foto, project en maker liggen daarna vast.
create or replace function public.controlepunt_bijwerken() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.aangemaakt_door := public.wie();
    new.aangemaakt_op := now();
  else
    new.project_id := old.project_id;
    new.foto := old.foto;
    new.aangemaakt_door := old.aangemaakt_door;
    new.aangemaakt_op := old.aangemaakt_op;
  end if;
  if new.opgelost then
    if tg_op = 'INSERT' or not old.opgelost then
      new.opgelost_door := public.wie();
      new.opgelost_op := now();
    else
      new.opgelost_door := old.opgelost_door;
      new.opgelost_op := old.opgelost_op;
    end if;
  else
    new.opgelost_door := null;
    new.opgelost_op := null;
  end if;
  return new;
end $$;

create trigger controlepunten_bijwerken before insert or update on public.controlepunten
  for each row execute function public.controlepunt_bijwerken();

alter table public.leveranciers enable row level security;
alter table public.controlepunten enable row level security;

create policy leveranciers_lezen on public.leveranciers for select to authenticated using (public.is_medewerker());
create policy leveranciers_maken on public.leveranciers for insert to authenticated with check (public.is_medewerker());
create policy leveranciers_wijzigen on public.leveranciers for update to authenticated using (public.is_medewerker()) with check (public.is_medewerker());
create policy leveranciers_verwijderen on public.leveranciers for delete to authenticated using (public.is_medewerker());

create policy controlepunten_lezen on public.controlepunten for select to authenticated using (public.is_medewerker());
create policy controlepunten_maken on public.controlepunten for insert to authenticated with check (public.is_medewerker());
create policy controlepunten_wijzigen on public.controlepunten for update to authenticated using (public.is_medewerker()) with check (public.is_medewerker());
create policy controlepunten_verwijderen on public.controlepunten for delete to authenticated using (public.is_medewerker());

-- De foto's: besloten, alleen afbeeldingen tot 10 MB, alleen voor medewerkers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('controle', 'controle', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy controle_fotos_lezen on storage.objects for select to authenticated
  using (bucket_id = 'controle' and public.is_medewerker());
create policy controle_fotos_uploaden on storage.objects for insert to authenticated
  with check (bucket_id = 'controle' and public.is_medewerker());
create policy controle_fotos_verwijderen on storage.objects for delete to authenticated
  using (bucket_id = 'controle' and public.is_medewerker());

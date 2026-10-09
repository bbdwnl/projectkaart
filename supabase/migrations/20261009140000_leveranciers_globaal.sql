-- Leveranciers kunnen nu ook globaal: één lijst voor alle projecten. Op een project kies je uit die lijst,
-- of je maakt een leverancier alleen voor dat project, eventueel meteen ook in de globale lijst.
-- Een aandachtspunt kan zonder leverancier; die kies je eventueel later in de lijst.

-- Welke leveranciers op een project werken.
create table public.project_leveranciers (
  project_id uuid not null references public.projecten (id) on delete cascade,
  leverancier_id uuid not null references public.leveranciers (id) on delete cascade,
  aangemaakt_op timestamptz not null default now(),
  primary key (project_id, leverancier_id)
);
create index project_leveranciers_leverancier on public.project_leveranciers (leverancier_id);
insert into public.project_leveranciers (project_id, leverancier_id) select project_id, id from public.leveranciers;

-- Een aandachtspunt hoort bij een leverancier die op zijn project werkt, of (nog) bij geen.
-- Zolang er punten naar verwijzen, kan de leverancier niet van het project af.
alter table public.controlepunten drop constraint controlepunten_leverancier_id_project_id_fkey;
alter table public.controlepunten alter column leverancier_id drop not null;
alter table public.controlepunten add constraint controlepunten_leverancier_op_project
  foreign key (project_id, leverancier_id) references public.project_leveranciers (project_id, leverancier_id);

-- Een leverancier hoort niet meer bij één project; de koppeling staat hierboven.
alter table public.leveranciers add column globaal boolean not null default false;
drop index public.leveranciers_naam;
alter table public.leveranciers drop column project_id;
create unique index leveranciers_globaal_naam on public.leveranciers (lower(trim(naam))) where globaal;
comment on column public.leveranciers.globaal is 'In de globale lijst: te kiezen op elk project. Anders alleen voor het project waarvoor hij is aangemaakt.';

-- Een leverancier uit de globale lijst haal je niet uit de app weg; een leverancier van één project wel.
drop policy leveranciers_verwijderen on public.leveranciers;
create policy leveranciers_verwijderen on public.leveranciers for delete to authenticated using (public.is_medewerker() and not globaal);

alter table public.project_leveranciers enable row level security;
create policy project_leveranciers_lezen on public.project_leveranciers for select to authenticated using (public.is_medewerker());
create policy project_leveranciers_maken on public.project_leveranciers for insert to authenticated with check (public.is_medewerker());
create policy project_leveranciers_verwijderen on public.project_leveranciers for delete to authenticated using (public.is_medewerker());

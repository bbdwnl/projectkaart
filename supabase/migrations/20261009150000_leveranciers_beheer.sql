-- Instellingen: de globale lijst met leveranciers beheren.
-- Een leverancier die nog op een project staat, kan niet weg: dan haal je hem alleen uit de globale lijst,
-- of eerst van die projecten af. Een leverancier op geen enkel project mag wel weg, ook een globale.
alter table public.project_leveranciers drop constraint project_leveranciers_leverancier_id_fkey;
alter table public.project_leveranciers add constraint project_leveranciers_leverancier_id_fkey
  foreign key (leverancier_id) references public.leveranciers (id) on delete restrict;

drop policy leveranciers_verwijderen on public.leveranciers;
create policy leveranciers_verwijderen on public.leveranciers for delete to authenticated using (public.is_medewerker());

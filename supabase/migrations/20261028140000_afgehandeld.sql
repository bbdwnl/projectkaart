-- Uit het prototype ("Archief (afgehandeld)"): een project in nazorg dat helemaal klaar is. Het blijft in nazorg,
-- maar staat onder Projecten niet meer in de kolom, behalve als je afgehandelde projecten laat zien.
alter table public.projecten
  add column if not exists afgehandeld boolean not null default false;
comment on column public.projecten.afgehandeld is 'Nazorg is helemaal klaar; telt niet meer mee onder Projecten.';

drop trigger projecten_log on public.projecten;
create trigger projecten_log after update on public.projecten for each row execute function public.log_wijziging(
  'fase', 'subfase', 'prio', 'wachtkamer', 'afgehandeld', 'nummer', 'naam', 'postcode', 'huisnummer', 'straat', 'plaats', 'm2', 'soort', 'slagingskans',
  'am', 'po', 'pm', 'opzichter', 'buddy',
  'datum_casco', 'datum_voorbereiding', 'datum_inkoop', 'datum_afbouw', 'datum_oplevering',
  'prognose_casco', 'prognose_afbouw', 'prognose_oplevering',
  'sharepoint_url', 'extern_url', 'notitieblok_url', 'tekeningen_locatie');

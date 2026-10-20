-- De prognose van een project in lead of haalbaarheid: wanneer de bouw naar verwachting start en klaar is.
-- Naast de vijf harde datums, die pas vastliggen in de ontwikkeling. Voor het planningsoverzicht van Haalbaarheid.

-- If not exists: op de gekoppelde database stonden de kolommen er al (met de hand gezet, vóór de migratiegeschiedenis).
alter table public.projecten
  add column if not exists prognose_casco date,
  add column if not exists prognose_afbouw date,
  add column if not exists prognose_oplevering date;
comment on column public.projecten.prognose_casco is 'Prognose start casco, tijdens lead en haalbaarheid.';
comment on column public.projecten.prognose_afbouw is 'Prognose start afbouw, tijdens lead en haalbaarheid.';
comment on column public.projecten.prognose_oplevering is 'Prognose oplevering, tijdens lead en haalbaarheid.';

drop trigger projecten_log on public.projecten;
create trigger projecten_log after update on public.projecten for each row execute function public.log_wijziging(
  'fase', 'prio', 'nummer', 'naam', 'postcode', 'huisnummer', 'straat', 'plaats', 'm2', 'soort', 'slagingskans', 'am', 'po', 'pm', 'opzichter',
  'datum_casco', 'datum_voorbereiding', 'datum_inkoop', 'datum_afbouw', 'datum_oplevering',
  'prognose_casco', 'prognose_afbouw', 'prognose_oplevering',
  'sharepoint_url', 'extern_url', 'notitieblok_url', 'tekeningen_locatie');

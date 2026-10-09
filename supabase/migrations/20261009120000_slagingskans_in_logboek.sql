-- De slagingskans van een lead is te wijzigen op de kaart en komt, net als de andere projectvelden, in het logboek.
drop trigger projecten_log on public.projecten;
create trigger projecten_log after update on public.projecten for each row execute function public.log_wijziging(
  'fase', 'prio', 'nummer', 'afas_nummer', 'naam', 'adres', 'm2', 'soort', 'slagingskans', 'am', 'po', 'pm', 'opzichter',
  'datum_casco', 'datum_voorbereiding', 'datum_inkoop', 'datum_afbouw', 'datum_oplevering',
  'sharepoint_url', 'extern_url', 'notitieblok_url', 'tekeningen_locatie');

-- Het projectnummer is het nummer uit AFAS: één veld (nummer) in plaats van twee.
-- Het adres in delen: postcode en huisnummer, met straat en plaats uit de BAG (PDOK) of met de hand.

-- Eerst het logboek uit, zodat het samenvoegen er niet in komt.
drop trigger projecten_log on public.projecten;

-- Een AFAS-nummer zonder projectnummer gaat mee, tenzij een ander project dat nummer al heeft.
update public.projecten p set nummer = p.afas_nummer
  where p.nummer is null and p.afas_nummer is not null
    and not exists (select 1 from public.projecten q where q.nummer = p.afas_nummer);
alter table public.projecten drop column afas_nummer;
comment on column public.projecten.nummer is 'Het projectnummer uit AFAS, bijvoorbeeld P20038; de sleutel voor een latere koppeling.';

alter table public.projecten rename column adres to straat;
alter table public.projecten add column postcode text, add column huisnummer text, add column bag_id text;
comment on column public.projecten.postcode is 'Postcode als 1234 AB.';
comment on column public.projecten.huisnummer is 'Huisnummer met letter en toevoeging, zoals 8A-1.';
comment on column public.projecten.straat is 'Uit de BAG bij postcode en huisnummer, of met de hand (bijvoorbeeld bij nieuwbouw).';
comment on column public.projecten.bag_id is 'Het BAG-object bij postcode en huisnummer (adresseerbaar object), voor de link naar de BAG Viewer. Leeg als het adres niet in de BAG staat.';

-- Het logboek volgt de nieuwe velden; de plaats komt er nu ook in.
create trigger projecten_log after update on public.projecten for each row execute function public.log_wijziging(
  'fase', 'prio', 'nummer', 'naam', 'postcode', 'huisnummer', 'straat', 'plaats', 'm2', 'soort', 'slagingskans', 'am', 'po', 'pm', 'opzichter',
  'datum_casco', 'datum_voorbereiding', 'datum_inkoop', 'datum_afbouw', 'datum_oplevering',
  'sharepoint_url', 'extern_url', 'notitieblok_url', 'tekeningen_locatie');

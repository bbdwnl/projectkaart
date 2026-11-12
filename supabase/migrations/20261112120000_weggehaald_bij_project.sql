-- Een standaardtaak die in één project niet nodig is, haal je daar weg (beslissing 42). Het takenpakket blijft de
-- standaard bij het aanmaken; daarna maak je het project specifiek. De regel blijft bestaan, met status, document en
-- opmerkingen, zodat terugzetten alles terugbrengt. Weghalen en terugzetten komen in het logboek.
-- Een uitzondering haal je nog steeds echt weg (die heeft een eigen regel per project).
alter table public.taken add column weggehaald boolean not null default false;
alter table public.taken add constraint weggehaald_alleen_standaard check (not weggehaald or uitzondering_id is null);

drop trigger taken_log on public.taken;
create trigger taken_log after insert or update or delete on public.taken for each row execute function public.log_wijziging(
  'status', 'eigenaar', 'klantakkoord', 'document_url', 'document_naam', 'reden_nvt', 'deadline', 'aanleiding', 'weggehaald');

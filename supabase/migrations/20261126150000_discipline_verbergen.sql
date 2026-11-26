-- Een discipline die in één project niet nodig is (geen lift, geen zonnepanelen), verberg je daar (beslissing 48).
-- Hij telt dan niet mee in "x / y ingevuld" en staat onderaan onder Verborgen, om terug te zetten. Een contact dat er
-- al stond, blijft bewaard. Verbergen kan alleen zonder leverancier: wie er een heeft, is nodig.
alter table public.project_disciplines add column verborgen boolean not null default false;
alter table public.project_disciplines add constraint verborgen_zonder_leverancier check (not verborgen or leverancier_id is null);
comment on column public.project_disciplines.verborgen is 'Niet nodig in dit project: verborgen in de lijst per discipline, terug te zetten.';

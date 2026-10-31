-- Een standaardtaak die uit het takenpakket gaat, blijft staan op de projecten die er toen al waren (beslissing 41).
-- Welke taken dat zijn en sinds wanneer, staat in een eigen rij in instellingen: vervallen (de vorm staat in
-- app/lib/instellingen.ts). Dezelfde rechten als de andere lijsten: iedereen leest, alleen het MT schrijft.
alter table public.instellingen drop constraint if exists instellingen_sleutel_check;
alter table public.instellingen add constraint instellingen_sleutel_check
  check (sleutel in ('mensen', 'labels', 'takenpakket', 'overdracht', 'vervallen'));

-- Gegenereerd door scripts/seed-sql.mjs uit app/data/projecten.json. Niet met de hand wijzigen.
-- De lopende projecten uit het prototype (stand van de vaste lijst in de pagina);
-- de live statussen uit het prototype komen later via een import.
insert into public.projecten (slug, nummer, naam, plaats, fase, prio, am, po, pm, opzichter, datum_casco, datum_voorbereiding, datum_inkoop, datum_afbouw, datum_oplevering) values
  ('p20032-amersfoort-laakse-tuinen', 'P20032', 'Amersfoort Laakse tuinen', 'Amersfoort', 'ontwikkeling', false, null, 'Michiel', null, null, '2026-05-01', '2026-11-09', '2027-01-18', '2027-03-01', '2027-07-30'),
  ('p25036-amersfoort-nieuwland', 'P25036', 'Amersfoort Nieuwland', 'Amersfoort', 'ontwikkeling', true, null, 'Michiel', null, null, null, '2026-07-25', '2026-10-03', '2026-11-14', null),
  ('p25012-soest', 'P25012', 'Soest', 'Soest', 'ontwikkeling', true, null, 'Michiel', null, null, null, '2026-08-11', '2026-10-20', '2026-12-01', '2027-04-01'),
  ('p23069-apeldoorn-sluisoordlaan', 'P23069', 'Apeldoorn Sluisoordlaan', 'Apeldoorn', 'ontwikkeling', false, null, 'Michiel', null, null, '2027-03-01', '2027-03-11', '2027-05-20', null, null),
  ('p20038-apeldoorn-vlijtseweg', 'P20038', 'Apeldoorn Vlijtseweg', 'Apeldoorn', 'ontwikkeling', true, null, 'Michiel', null, null, null, '2026-08-11', '2026-10-20', '2026-12-01', '2027-04-01'),
  ('p17042-tilburg-groenewoud', 'P17042', 'Tilburg Groenewoud', 'Tilburg', 'ontwikkeling', false, null, 'Michiel', null, null, '2026-08-01', '2026-12-10', '2027-02-18', '2027-04-01', '2027-08-31'),
  ('p26025-maarssen-bisonspoor-ggd', 'P26025', 'Maarssen - Bisonspoor GGD', 'Maarssen', 'uitvoering', true, null, 'Benno', null, null, null, '2026-08-11', '2026-10-20', '2026-12-01', '2027-03-01'),
  ('p20054-waardenburg', 'P20054', 'Waardenburg', 'Waardenburg', 'ontwikkeling', false, null, 'Michiel', null, null, '2026-09-01', '2026-10-12', '2026-12-21', '2027-02-01', '2027-06-14'),
  ('p22004-rozenburg', 'P22004', 'Rozenburg', 'Rozenburg', 'uitvoering', true, null, 'Benno', null, null, null, '2026-08-11', '2026-10-20', '2026-12-01', '2027-02-01'),
  ('p21021-buren', 'P21021', 'Buren', 'Buren', 'ontwikkeling', false, null, 'Benno', null, null, '2026-11-01', '2026-10-12', '2026-12-21', '2027-02-01', '2027-05-30'),
  ('p21016-tilburg-beethoven', 'P21016', 'Tilburg Beethoven', 'Tilburg', 'ontwikkeling', false, null, 'Benno', null, null, '2026-05-01', '2026-09-15', '2026-11-24', '2027-01-05', '2027-04-30'),
  ('p23038-tilburg-scarlatti', 'P23038', 'Tilburg Scarlatti', 'Tilburg', 'ontwikkeling', false, null, 'Benno', null, null, '2026-11-01', '2026-09-24', '2026-12-03', '2027-01-14', '2027-05-30'),
  ('p23078-kesteren', 'P23078', 'Kesteren', 'Kesteren', 'ontwikkeling', false, null, 'Benno', null, null, '2026-05-01', '2026-11-09', '2027-01-18', '2027-03-01', '2027-06-30'),
  ('p23028-leersum', 'P23028', 'Leersum', 'Leersum', 'ontwikkeling', false, null, 'Benno', null, null, null, '2027-07-12', '2027-09-20', '2027-11-01', '2028-02-28'),
  ('p15019-hilversum-artsenij', 'P15019', 'Hilversum Artsenij', 'Hilversum', 'ontwikkeling', false, null, 'Benno', null, null, '2026-12-01', '2026-11-09', '2027-01-18', '2027-03-01', '2027-06-30'),
  ('p23066-enschede-hap-richters-en-van-huizen', 'P23066', 'Enschede - HAP Richters en van Huizen', 'Enschede', 'ontwikkeling', false, null, 'Michiel', null, null, '2027-07-01', null, null, '2028-07-01', '2028-10-28'),
  ('p26001-veenendaal-hap-pelzer-houweling', 'P26001', 'Veenendaal - HAP Pelzer & Houweling', 'Veenendaal', 'ontwikkeling', false, null, 'Benno', null, null, null, '2026-11-09', '2027-01-18', '2027-03-01', '2027-06-30'),
  ('p26018-den-helder', 'P26018', 'Den Helder', 'Den Helder', 'ontwikkeling', false, null, 'Benno', null, null, null, '2027-02-09', '2027-04-20', '2027-06-01', '2027-11-04'),
  ('hoevelaken', null, 'Hoevelaken', 'Hoevelaken', 'ontwikkeling', false, null, 'Benno', null, null, null, '2026-11-09', '2027-01-18', '2027-03-01', '2027-06-14'),
  ('p23008-schagerburg', 'P23008', 'Schagerburg', 'Schagerbrug', 'uitvoering', true, null, 'Michiel', null, null, null, '2026-06-11', '2026-08-20', '2026-10-01', '2027-03-31'),
  ('p18025-rijswijk', 'P18025', 'Rijswijk', 'Rijswijk', 'uitvoering', false, null, null, null, null, null, null, null, '2026-07-01', '2026-12-18'),
  ('p23036-scharnegoutum', 'P23036', 'Scharnegoutum', 'Scharnegoutum', 'ontwikkeling', false, null, null, null, null, '2027-06-01', null, null, '2028-01-01', '2028-06-01'),
  ('p23068-sneek', 'P23068', 'Sneek', 'Sneek', 'uitvoering', true, null, 'Benno', null, null, null, '2026-05-12', '2026-07-21', '2026-09-01', '2027-01-31'),
  ('p22005-volkel', 'P22005', 'Volkel', 'Volkel', 'uitvoering', true, null, 'Michiel', null, null, null, '2026-05-12', '2026-07-21', '2026-09-01', '2027-04-14'),
  ('p19023-wassenaar', 'P19023', 'Wassenaar', 'Wassenaar', 'uitvoering', true, null, 'Benno', null, null, '2025-11-01', '2026-03-11', '2026-05-20', '2026-07-01', '2027-03-01'),
  ('p14041-mijdrecht', 'P14041', 'Mijdrecht', 'Mijdrecht', 'haalbaarheid', false, null, null, null, null, null, null, null, null, null),
  ('p23070-uden-pius-x', 'P23070', 'Uden Pius X', 'Uden', 'haalbaarheid', false, null, null, null, null, null, null, null, null, null)
on conflict (slug) do nothing;

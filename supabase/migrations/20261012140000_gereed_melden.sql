-- Controle in twee stappen. De leverancier vinkt op zijn pagina een punt af als opgelost (gereed gemeld); BbDW
-- controleert en tekent af. Pas na het aftekenen is het punt opgelost, en pas als alle punten van de leverancier
-- zijn afgetekend, gaat zijn link dicht (trigger deellinks_sluiten). Keurt BbDW het af, dan staat het punt weer open
-- voor de leverancier, met de reden erbij.
alter table public.controlepunten
  add column gereed_op timestamptz,
  add column gereed_door text,
  add column afgekeurd_op timestamptz,
  add column afgekeurd_door text,
  add column afgekeurd_reden text check (afgekeurd_reden is null or length(afgekeurd_reden) <= 1000);
comment on column public.controlepunten.gereed_op is 'De leverancier meldde het punt opgelost (via zijn pagina); BbDW moet nog aftekenen.';

-- Wie een punt maakt, oplost, gereed meldt of afkeurt, vult de database in.
-- Gereed melden en terugdraaien kan alleen de leverancier, via de server; BbDW kan een melding alleen afkeuren of aftekenen.
create or replace function public.controlepunt_bijwerken() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.aangemaakt_door := public.wie();
    new.aangemaakt_op := now();
    new.gereed_op := null;
    new.gereed_door := null;
    new.afgekeurd_op := null;
    new.afgekeurd_door := null;
    new.afgekeurd_reden := null;
  else
    new.project_id := old.project_id;
    new.foto := old.foto;
    new.aangemaakt_door := old.aangemaakt_door;
    new.aangemaakt_op := old.aangemaakt_op;

    if old.opgelost and not new.opgelost then
      -- Weer open: wat de leverancier meldde en een oude afkeuring gelden niet meer.
      new.gereed_op := null;
      new.gereed_door := null;
      new.afgekeurd_op := null;
      new.afgekeurd_door := null;
      new.afgekeurd_reden := null;
    elsif public.is_server() and not old.opgelost and not new.opgelost then
      -- De leverancier: gereed melden (gereed_door is zijn naam) of terugdraaien (null).
      new.gereed_op := case when new.gereed_door is null then null when old.gereed_op is null then now() else old.gereed_op end;
      new.afgekeurd_op := old.afgekeurd_op;
      new.afgekeurd_door := old.afgekeurd_door;
      new.afgekeurd_reden := old.afgekeurd_reden;
    elsif old.gereed_op is not null and new.gereed_op is null and not new.opgelost then
      -- BbDW keurt de melding af: weer open voor de leverancier, met de reden.
      new.gereed_door := null;
      new.afgekeurd_op := now();
      new.afgekeurd_door := public.wie();
      new.afgekeurd_reden := nullif(trim(coalesce(new.afgekeurd_reden, '')), '');
    else
      new.gereed_op := old.gereed_op;
      new.gereed_door := old.gereed_door;
      new.afgekeurd_op := old.afgekeurd_op;
      new.afgekeurd_door := old.afgekeurd_door;
      new.afgekeurd_reden := old.afgekeurd_reden;
    end if;
  end if;

  if new.opgelost then
    if tg_op = 'INSERT' or not old.opgelost then
      new.opgelost_door := public.wie();
      new.opgelost_op := now();
    else
      new.opgelost_door := old.opgelost_door;
      new.opgelost_op := old.opgelost_op;
    end if;
  else
    new.opgelost_door := null;
    new.opgelost_op := null;
  end if;
  return new;
end $$;

-- Proefversie: wat de leverancier afvinkte op zijn pagina, per punt: {"<punt-id>": {"op": "...", "door": "..."}}.
-- De browser van de tester haalt het op en werkt zijn eigen gegevens bij; afkeuren en aftekenen gaan andersom.
alter table public.proef_deellinks add column gereed jsonb not null default '{}';

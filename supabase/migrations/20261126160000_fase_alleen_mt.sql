-- Alleen het MT wisselt de fase van een project (beslissing 49). Aanmaken in een fase mag iedereen; de fase daarna
-- veranderen niet. De database dwingt het af, ook voor Copilot (dat werkt met de inlog van de medewerker). Zonder
-- ingelogde gebruiker (de service-rol, de SQL-editor) gaat het wel: dat is beheer, geen medewerker.
create or replace function public.fase_alleen_mt() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.fase is distinct from old.fase and auth.uid() is not null and not public.is_mt() then
    raise exception 'Alleen het MT kan de fase van een project wisselen.';
  end if;
  return new;
end $$;
create trigger projecten_fase_alleen_mt before update of fase on public.projecten
  for each row execute function public.fase_alleen_mt();

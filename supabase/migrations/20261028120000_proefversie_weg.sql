-- De proefversie is uit de app: de kopieën van deellinks uit de browser van testers zijn niet meer nodig.
-- De bucket proef (pdf's die testers uploadden) haal je leeg en weg in het dashboard (Storage);
-- Supabase laat dat niet via SQL toe.
drop table if exists public.proef_deellinks;

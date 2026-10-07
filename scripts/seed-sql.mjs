// Maakt supabase/seed.sql uit app/data/projecten.json (de lopende projecten uit het prototype).
// Veilig om opnieuw te draaien: bestaande projecten (zelfde slug) worden overgeslagen.
import { readFileSync, writeFileSync } from 'node:fs'

const projecten = JSON.parse(readFileSync(new URL('../app/data/projecten.json', import.meta.url), 'utf8'))
const sql = v => v === null || v === undefined ? 'null' : typeof v === 'boolean' ? String(v) : `'${String(v).replaceAll('\'', '\'\'')}'`
const kolommen = ['slug', 'nummer', 'naam', 'plaats', 'fase', 'prio', 'am', 'po', 'pm', 'opzichter',
  'datum_casco', 'datum_voorbereiding', 'datum_inkoop', 'datum_afbouw', 'datum_oplevering']

const regels = projecten.map(p => `  (${kolommen.map(k => sql(p[k])).join(', ')})`)
const uit = `-- Gegenereerd door scripts/seed-sql.mjs uit app/data/projecten.json. Niet met de hand wijzigen.
-- De lopende projecten uit het prototype (stand van de vaste lijst in de pagina);
-- de live statussen uit het prototype komen later via een import.
insert into public.projecten (${kolommen.join(', ')}) values
${regels.join(',\n')}
on conflict (slug) do nothing;
`
writeFileSync(new URL('../supabase/seed.sql', import.meta.url), uit)
console.log(`supabase/seed.sql: ${projecten.length} projecten`)

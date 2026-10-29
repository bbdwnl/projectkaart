// De dagelijkse back-up (Vercel Cron → /api/backup): alle rijen van alle tabellen in public, als één SQL-bestand in
// een besloten bucket in Supabase Storage (Frankfurt). De structuur staat in supabase/migrations; met die twee samen
// zet je de database terug (README, Back-up). Foto's en tekeningen staan in Storage zelf en zitten er niet in.

/** De tabellen, in een volgorde die bij terugzetten klopt, met waarop de server ze sorteert bij het ophalen. */
export const TABELLEN: { naam: string, volgorde: string, identity?: string }[] = [
  { naam: 'profielen', volgorde: 'id' },
  { naam: 'projecten', volgorde: 'id' },
  { naam: 'uitzonderingen', volgorde: 'id' },
  { naam: 'taken', volgorde: 'id' },
  { naam: 'opmerkingen', volgorde: 'id' },
  { naam: 'financien', volgorde: 'project_id' },
  { naam: 'logboek', volgorde: 'id', identity: 'id' },
  { naam: 'leveranciers', volgorde: 'id' },
  { naam: 'project_leveranciers', volgorde: 'project_id,leverancier_id' },
  { naam: 'project_disciplines', volgorde: 'project_id,discipline' },
  { naam: 'tekeningen', volgorde: 'id' },
  { naam: 'controlepunten', volgorde: 'id' },
  { naam: 'deellinks', volgorde: 'id' },
  { naam: 'acties', volgorde: 'id' },
  { naam: 'adressen', volgorde: 'naam' },
  { naam: 'instellingen', volgorde: 'sleutel' },
  { naam: 'feedback', volgorde: 'id' },
]

export const BUCKET = 'backups'
/** Zoveel dagen blijven bewaard; oudere bestanden gaan weg. */
export const BEWAAR_DAGEN = 30

/** De naam van het bestand van een dag: 2026-10-29.sql, zodat ze op naam ook op datum staan. */
export const bestandVan = (d: Date) => `${d.toISOString().slice(0, 10)}.sql`

/**
 * Het SQL-bestand. Per tabel één insert uit JSON (json_populate_recordset): de database zet zelf elke kolom om, ook
 * datums, lijsten en JSON, dus er hoeft niets met de hand te worden geëscaped. Tijdens het terugzetten staan triggers
 * en verwijzingen uit (session_replication_role = replica), zodat wie en wanneer blijven zoals ze waren.
 */
export function maakSql(tabellen: { naam: string, rijen: unknown[] }[], moment: Date): string {
  const regels = [
    `-- Back-up Projectkaart BbDW, ${moment.toISOString()}`,
    '-- Alle rijen van alle tabellen in public. De structuur staat in supabase/migrations: zet eerst die op een lege',
    '-- database (supabase db push), en voer daarna dit bestand uit in de SQL-editor. Zie README, Back-up.',
    ...tabellen.map(t => `-- ${t.naam}: ${t.rijen.length} ${t.rijen.length === 1 ? 'rij' : 'rijen'}`),
    '',
    'set session_replication_role = replica;',
    'begin;',
  ]
  for (const t of tabellen) {
    if (!t.rijen.length) continue
    const json = JSON.stringify(t.rijen)
    // Een dollar-tag die niet in de gegevens voorkomt, zodat geen enkele tekst de SQL kan afbreken.
    let tag = 'rijen'
    for (let i = 2; json.includes(`$${tag}$`); i++) tag = `rijen${i}`
    const identity = TABELLEN.find(x => x.naam === t.naam)?.identity
    regels.push(`insert into public.${t.naam}${identity ? ' overriding system value' : ''} select * from json_populate_recordset(null::public.${t.naam}, $${tag}$${json}$${tag}$);`)
    if (identity) regels.push(`select setval(pg_get_serial_sequence('public.${t.naam}', '${identity}'), coalesce((select max(${identity}) from public.${t.naam}), 1));`)
  }
  regels.push('commit;', 'set session_replication_role = origin;', '')
  return regels.join('\n')
}

/** Welke bestanden weg mogen: ouder dan het aantal dagen dat we bewaren. */
export function teOud(namen: string[], nu: Date, dagen = BEWAAR_DAGEN): string[] {
  const grens = new Date(nu.getTime() - dagen * 86_400_000).toISOString().slice(0, 10)
  return namen.filter(n => /^\d{4}-\d{2}-\d{2}\.sql$/.test(n) && n.slice(0, 10) < grens)
}

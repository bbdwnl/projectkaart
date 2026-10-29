import { describe, expect, it } from 'vitest'
import { bestandVan, maakSql, TABELLEN, teOud } from '../server/utils/backup'

describe('back-up', () => {
  const nu = new Date('2026-10-29T03:00:00Z')

  it('maakt per tabel één insert uit JSON, met triggers uit, en zet de teller van het logboek goed', () => {
    const sql = maakSql([
      { naam: 'projecten', rijen: [{ id: 'p1', naam: "D'n Bosch", soort: ['tk'] }] },
      { naam: 'logboek', rijen: [{ id: 7, veld: 'fase' }] },
      { naam: 'feedback', rijen: [] },
    ], nu)
    expect(sql).toContain('set session_replication_role = replica;')
    expect(sql).toContain(`insert into public.projecten select * from json_populate_recordset(null::public.projecten, $rijen$[{"id":"p1","naam":"D'n Bosch","soort":["tk"]}]$rijen$);`)
    expect(sql).toContain('insert into public.logboek overriding system value select')
    expect(sql).toContain("select setval(pg_get_serial_sequence('public.logboek', 'id')")
    expect(sql).not.toContain('public.feedback select')
    expect(sql).toContain('-- feedback: 0 rijen')
    expect(sql.trim().endsWith('set session_replication_role = origin;')).toBe(true)
  })

  it('kiest een andere dollar-tag als de gegevens de tag bevatten', () => {
    const sql = maakSql([{ naam: 'opmerkingen', rijen: [{ tekst: 'kijk: $rijen$ ); drop table x; --' }] }], nu)
    expect(sql).toContain('$rijen2$[{"tekst":"kijk: $rijen$ ); drop table x; --"}]$rijen2$')
  })

  it('heeft elke tabel uit de migraties, behalve wat weg is', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const map = new URL('../supabase/migrations/', import.meta.url)
    const sql = readdirSync(map).map(f => readFileSync(new URL(f, map), 'utf8')).join('\n')
    const gemaakt = [...sql.matchAll(/create table public\.([a-z_]+)/g)].map(m => m[1]!)
    const weg = [...sql.matchAll(/drop table (?:if exists )?public\.([a-z_]+)/g)].map(m => m[1]!)
    expect(TABELLEN.map(t => t.naam).sort()).toEqual(gemaakt.filter(t => !weg.includes(t)).sort())
  })

  it('bewaart dertig dagen, op naam van het bestand', () => {
    expect(bestandVan(nu)).toBe('2026-10-29.sql')
    expect(teOud(['2026-09-28.sql', '2026-09-29.sql', '2026-10-29.sql', 'iets-anders.txt'], nu)).toEqual(['2026-09-28.sql'])
  })
})

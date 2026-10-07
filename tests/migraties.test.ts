import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

// Draait de migraties en de seed op PGlite (Postgres in WASM), met een
// minimale nabootsing van wat Supabase levert (auth.users, auth.jwt, rollen).
const AUTH_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create role authenticated;
  create role anon;
  grant usage on schema auth to authenticated;
`
const map = new URL('../supabase/', import.meta.url)
const migraties = readdirSync(new URL('migrations/', map)).sort().map(f => readFileSync(new URL(`migrations/${f}`, map), 'utf8'))

const MICHIEL = { sub: '00000000-0000-0000-0000-000000000001', email: 'michiel@bbdw.nl', app_metadata: { provider: 'azure' }, user_metadata: { full_name: 'Michiel' } }
const BENNO = { sub: '00000000-0000-0000-0000-000000000002', email: 'benno@bbdw.nl', app_metadata: { provider: 'azure' }, user_metadata: { full_name: 'Benno van Bergen' } }
const VREEMD = { sub: '00000000-0000-0000-0000-000000000003', email: 'iemand@gmail.com', app_metadata: { provider: 'azure' }, user_metadata: {} }
const WACHTWOORD = { ...MICHIEL, sub: '00000000-0000-0000-0000-000000000004', app_metadata: { provider: 'email' } }

let db: PGlite
let projectId: string

/** Voert sql uit als ingelogde gebruiker (rol authenticated, met deze claims). */
async function als<T = Record<string, unknown>>(claims: object, query: string, params: unknown[] = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false);`)
  try {
    return (await db.query<T>(query, params)).rows
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`)
  }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(AUTH_STUB)
  for (const m of migraties) await db.exec(m)
  await db.exec(readFileSync(new URL('seed.sql', map), 'utf8'))
  await db.exec(`grant usage on schema public to authenticated, anon; grant all on all tables in schema public to authenticated, anon;
    revoke update on public.profielen from authenticated; grant update (naam) on public.profielen to authenticated;`)
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{"full_name":"Michiel"}'), ($3, $4, '{"full_name":"Benno van Bergen"}')`,
    [MICHIEL.sub, MICHIEL.email, BENNO.sub, BENNO.email])
  await db.query(`update public.profielen set rol = 'mt' where id = $1`, [BENNO.sub])
  projectId = (await db.query<{ id: string }>(`select id from public.projecten where nummer = 'P20038'`)).rows[0]!.id
}, 60_000)

describe('seed', () => {
  it('zet de 27 lopende projecten erin, en opnieuw draaien verandert niets', async () => {
    await db.exec(readFileSync(new URL('seed.sql', map), 'utf8'))
    const [{ n }] = (await db.query<{ n: number }>(`select count(*)::int as n from public.projecten`)).rows as [{ n: number }]
    expect(n).toBe(27)
  })
})

describe('rechten', () => {
  it('laat alleen Microsoft-accounts van het BBDW-domein binnen', async () => {
    expect(await als(MICHIEL, `select id from public.projecten`)).toHaveLength(27)
    expect(await als(VREEMD, `select id from public.projecten`)).toHaveLength(0)
    expect(await als(WACHTWOORD, `select id from public.projecten`)).toHaveLength(0)
  })
  it('toont de financiën alleen aan het MT', async () => {
    await db.query(`insert into public.financien (project_id, opdracht_uren) values ($1, 78500)`, [projectId])
    expect(await als(MICHIEL, `select * from public.financien`)).toHaveLength(0)
    expect(await als(BENNO, `select * from public.financien`)).toHaveLength(1)
  })
  it('laat niemand zichzelf MT maken', async () => {
    await expect(als(MICHIEL, `update public.profielen set rol = 'mt' where id = '${MICHIEL.sub}'`)).rejects.toThrow()
  })
  it('laat niemand zelf in het logboek schrijven', async () => {
    await expect(als(MICHIEL, `insert into public.logboek (project_id, door, tabel, veld) values ('${projectId}', 'nep', 'taken', 'status')`)).rejects.toThrow()
  })
})

describe('aftekenen en logboek', () => {
  it('vult wie en wanneer in bij definitief en klantakkoord, en logt de wijziging', async () => {
    const [taak] = await als<{ id: string, afgetekend_door: string | null }>(MICHIEL,
      `insert into public.taken (project_id, lijst, sleutel, fase, status) values ($1, 'ontwikkeling', 'do_casco', 'ontwikkeling', 'loopt') returning id, afgetekend_door`, [projectId])
    expect(taak!.afgetekend_door).toBeNull()

    const [na] = await als<{ afgetekend_door: string, klantakkoord_door: string }>(BENNO,
      `update public.taken set status = 'definitief', klantakkoord = true, document_naam = 'P20038 – DO Casco – rev D.pdf' where id = $1 returning afgetekend_door, klantakkoord_door`, [taak!.id])
    expect(na).toMatchObject({ afgetekend_door: 'Benno van Bergen', klantakkoord_door: 'Benno van Bergen' })

    // nog een wijziging laat de aftekening staan, ook als de browser iets anders meestuurt
    const [later] = await als<{ afgetekend_door: string }>(MICHIEL,
      `update public.taken set notitie = 'Rev D is leidend', afgetekend_door = 'Vervalst' where id = $1 returning afgetekend_door`, [taak!.id])
    expect(later!.afgetekend_door).toBe('Benno van Bergen')

    const log = await als<{ door: string, veld: string, oud: string | null, nieuw: string | null }>(MICHIEL,
      `select door, veld, oud, nieuw from public.logboek where taak_id = $1 order by id`, [taak!.id])
    expect(log.map(r => `${r.door}: ${r.veld} ${r.oud ?? '-'} -> ${r.nieuw ?? '-'}`)).toEqual([
      'Michiel: status - -> loopt',
      'Benno van Bergen: status loopt -> definitief',
      'Benno van Bergen: klantakkoord false -> true',
      'Benno van Bergen: document_naam - -> P20038 – DO Casco – rev D.pdf',
      'Michiel: notitie - -> Rev D is leidend',
    ])
  })

  it('logt een uitzondering die erbij komt en weer weggaat', async () => {
    const [u] = await als<{ id: string, aangemaakt_door: string }>(MICHIEL,
      `insert into public.uitzonderingen (titel, fase) values ('Extra bodemonderzoek (PFAS)', 'ontwikkeling') returning id, aangemaakt_door`)
    expect(u!.aangemaakt_door).toBe('Michiel')
    await expect(als(MICHIEL, `insert into public.uitzonderingen (titel, fase) values ('extra bodemonderzoek (pfas) ', 'ontwikkeling')`)).rejects.toThrow()

    const [taak] = await als<{ id: string }>(MICHIEL,
      `insert into public.taken (project_id, uitzondering_id, fase, deadline) values ($1, $2, 'ontwikkeling', '2026-10-15') returning id`, [projectId, u!.id])
    await als(MICHIEL, `delete from public.taken where id = $1`, [taak!.id])
    const log = await als<{ veld: string }>(MICHIEL, `select veld from public.logboek where taak_id = $1 order by id`, [taak!.id])
    expect(log.map(r => r.veld)).toEqual(['toegevoegd', 'deadline', 'verwijderd'])
  })

  it('weigert een standaardtaak zonder lijst of met een fase die niet bij de lijst past', async () => {
    await expect(als(MICHIEL, `insert into public.taken (project_id, sleutel, fase) values ($1, 'demarcatie', 'ontwikkeling')`, [projectId])).rejects.toThrow()
    await expect(als(MICHIEL, `insert into public.taken (project_id, lijst, sleutel, fase) values ($1, 'ontwikkeling', 'demarcatie', 'uitvoering')`, [projectId])).rejects.toThrow()
  })

  it('logt een faseswitch op het project', async () => {
    await als(MICHIEL, `update public.projecten set fase = 'uitvoering', afas_nummer = '12345' where id = $1`, [projectId])
    const log = await als<{ veld: string, nieuw: string }>(MICHIEL, `select veld, nieuw from public.logboek where tabel = 'projecten' and project_id = $1 order by id`, [projectId])
    expect(log).toEqual([{ veld: 'fase', nieuw: 'uitvoering' }, { veld: 'afas_nummer', nieuw: '12345' }])
  })
})

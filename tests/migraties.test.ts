import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

// Draait de migraties en de seed op PGlite (Postgres in WASM), met een
// minimale nabootsing van wat Supabase levert (auth.users, auth.jwt, rollen, storage).
const AUTH_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key, email text, encrypted_password text, raw_user_meta_data jsonb not null default '{}');
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create role authenticated;
  create role anon;
  create role service_role bypassrls;
  grant usage on schema auth to authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant all on storage.objects to authenticated;
`
const map = new URL('../supabase/', import.meta.url)
const migraties = readdirSync(new URL('migrations/', map)).sort().map(f => readFileSync(new URL(`migrations/${f}`, map), 'utf8'))

// Ingelogd met een link per mail: amr zegt wanneer (in seconden), zoals in het token van Supabase.
const ingelogd = (dagenGeleden = 0) => [{ method: 'otp', timestamp: Math.floor(Date.now() / 1000) - dagenGeleden * 24 * 3600 }]
const MICHIEL = { sub: '00000000-0000-0000-0000-000000000001', email: 'michiel@bbdw.nl', app_metadata: { provider: 'email' }, user_metadata: { full_name: 'Michiel' }, amr: ingelogd() }
const BENNO = { sub: '00000000-0000-0000-0000-000000000002', email: 'benno@bbdw.nl', app_metadata: { provider: 'email' }, user_metadata: { full_name: 'Benno van Bergen' }, amr: ingelogd() }
const VREEMD = { sub: '00000000-0000-0000-0000-000000000003', email: 'iemand@gmail.com', app_metadata: { provider: 'email' }, user_metadata: {}, amr: ingelogd() }
const VERLOPEN = { ...MICHIEL, amr: ingelogd(8) }
const ZONDER_MOMENT = { ...MICHIEL, amr: undefined }
// Iemand die vooraf met een eigen wachtwoord een account op het adres van een collega aanmaakte.
const WACHTWOORD = { ...MICHIEL, amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] }

let db: PGlite
let projectId: string

/** Voert sql uit als ingelogde gebruiker (rol authenticated, met deze claims), of in een andere rol. */
async function als<T = Record<string, unknown>>(claims: object, query: string, params: unknown[] = [], rol = 'authenticated') {
  await db.exec(`set role ${rol}; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false);`)
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
  await db.exec(`grant usage on schema public to authenticated, anon; grant all on all tables in schema public to authenticated, anon, service_role;
    grant usage on schema public to service_role;
    revoke update on public.profielen from authenticated; grant update (naam) on public.profielen to authenticated;`)
  await db.query(`insert into auth.users (id, email) values ($1, $2), ($3, $4)`, [MICHIEL.sub, MICHIEL.email, BENNO.sub, BENNO.email])
  // De naam die ze bij hun eerste inlog opgaven; Benno is MT.
  await db.query(`update public.profielen set naam = 'Michiel' where id = $1`, [MICHIEL.sub])
  await db.query(`update public.profielen set naam = 'Benno van Bergen', rol = 'mt' where id = $1`, [BENNO.sub])
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
  it('laat alleen adressen van het BBDW-domein binnen, alleen via een link, en een inlog maar een week', async () => {
    expect(await als(MICHIEL, `select id from public.projecten`)).toHaveLength(27)
    expect(await als({ ...MICHIEL, amr: ingelogd(6.9) }, `select id from public.projecten`)).toHaveLength(27)
    expect(await als(VREEMD, `select id from public.projecten`)).toHaveLength(0)
    expect(await als(VERLOPEN, `select id from public.projecten`)).toHaveLength(0)
    expect(await als(ZONDER_MOMENT, `select id from public.projecten`)).toHaveLength(0)
    expect(await als(WACHTWOORD, `select id from public.projecten`)).toHaveLength(0)
    expect(await als({ ...MICHIEL, amr: [{ method: 'magiclink', timestamp: Math.floor(Date.now() / 1000) }] }, `select id from public.projecten`)).toHaveLength(27)
  })
  it('maakt geen account voor een adres buiten het BBDW-domein', async () => {
    await expect(db.query(`insert into auth.users (id, email) values (gen_random_uuid(), 'iemand@gmail.com')`)).rejects.toThrow(/bbdw\.nl/)
    await expect(db.query(`update auth.users set email = 'michiel@gmail.com' where id = $1`, [MICHIEL.sub])).rejects.toThrow(/bbdw\.nl/)
  })
  it('zet de naam uit het profiel in het logboek, ook zonder naam in het token', async () => {
    const LINK = { sub: '00000000-0000-0000-0000-000000000005', email: 'jan.de.vries@bbdw.nl', app_metadata: { provider: 'email' }, user_metadata: {}, amr: ingelogd() }
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [LINK.sub, LINK.email])
    expect(await als(LINK, `select public.wie() as wie`)).toEqual([{ wie: 'jan.de.vries@bbdw.nl' }])
    await als(LINK, `update public.profielen set naam = 'Jan de Vries' where id = $1`, [LINK.sub])
    expect(await als(LINK, `select public.wie() as wie`)).toEqual([{ wie: 'Jan de Vries' }])
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
      `update public.taken set eigenaar = 'Architect', afgetekend_door = 'Vervalst' where id = $1 returning afgetekend_door`, [taak!.id])
    expect(later!.afgetekend_door).toBe('Benno van Bergen')

    const log = await als<{ door: string, veld: string, oud: string | null, nieuw: string | null }>(MICHIEL,
      `select door, veld, oud, nieuw from public.logboek where taak_id = $1 order by id`, [taak!.id])
    expect(log.map(r => `${r.door}: ${r.veld} ${r.oud ?? '-'} -> ${r.nieuw ?? '-'}`)).toEqual([
      'Michiel: status - -> loopt',
      'Benno van Bergen: status loopt -> definitief',
      'Benno van Bergen: klantakkoord false -> true',
      'Benno van Bergen: document_naam - -> P20038 – DO Casco – rev D.pdf',
      'Michiel: eigenaar - -> Architect',
    ])
  })

  it('vult bij een opmerking project, wie en wanneer in, logt hem en laat hem daarna staan', async () => {
    const [taak] = await als<{ id: string }>(MICHIEL,
      `insert into public.taken (project_id, lijst, sleutel, fase) values ($1, 'ontwikkeling', 'demarcatie', 'ontwikkeling') returning id`, [projectId])
    const [o] = await als<{ id: string, project_id: string, door: string, op: string }>(MICHIEL,
      `insert into public.opmerkingen (taak_id, project_id, tekst, door, op) values ($1, gen_random_uuid(), 'Rev D is leidend', 'Vervalst', '2020-01-01') returning id, project_id, door, op`, [taak!.id])
    expect(o).toMatchObject({ project_id: projectId, door: 'Michiel' })
    expect(new Date(o!.op).getFullYear()).toBeGreaterThan(2020)

    const log = await als<{ door: string, veld: string, nieuw: string }>(MICHIEL, `select door, veld, nieuw from public.logboek where taak_id = $1`, [taak!.id])
    expect(log).toEqual([{ door: 'Michiel', veld: 'opmerking', nieuw: 'Rev D is leidend' }])

    expect(await als(MICHIEL, `update public.opmerkingen set tekst = 'Anders' where id = $1 returning id`, [o!.id])).toHaveLength(0)
    expect(await als(MICHIEL, `delete from public.opmerkingen where id = $1 returning id`, [o!.id])).toHaveLength(0)
    expect(await als(VREEMD, `select id from public.opmerkingen`)).toHaveLength(0)
    await expect(als(MICHIEL, `insert into public.opmerkingen (taak_id, tekst) values ($1, '   ')`, [taak!.id])).rejects.toThrow()
  })

  it('vult bij een actie wie en wanneer in, en wie hem gereed meldde', async () => {
    const [a] = await als<{ id: string, aangemaakt_door: string, gereed_door: string | null }>(MICHIEL,
      `insert into public.acties (project_id, tekst, actiehouder, aangemaakt_door, gereed_door) values ($1, 'Kozijnmaten controleren', 'Carlo', 'Vervalst', 'Vervalst') returning id, aangemaakt_door, gereed_door`, [projectId])
    expect(a).toMatchObject({ aangemaakt_door: 'Michiel', gereed_door: null })
    const [gereed] = await als<{ gereed_door: string, aangemaakt_door: string }>(BENNO, `update public.acties set gereed = true, aangemaakt_door = 'Ander' where id = $1 returning gereed_door, aangemaakt_door`, [a!.id])
    expect(gereed).toEqual({ gereed_door: 'Benno van Bergen', aangemaakt_door: 'Michiel' })
    const [open] = await als<{ gereed_door: string | null }>(MICHIEL, `update public.acties set gereed = false where id = $1 returning gereed_door`, [a!.id])
    expect(open!.gereed_door).toBeNull()
    expect(await als(VREEMD, `select id from public.acties`)).toHaveLength(0)
  })

  it('houdt per discipline een leverancier van het project bij, en laat de discipline leeg als hij van het project gaat', async () => {
    const [l] = await als<{ id: string }>(MICHIEL, `insert into public.leveranciers (naam) values ('Liften Zuid') returning id`)
    // Niet op het project: mag niet.
    await expect(als(MICHIEL, `insert into public.project_disciplines (project_id, discipline, leverancier_id) values ($1, 'lift', $2)`, [projectId, l!.id])).rejects.toThrow()
    await als(MICHIEL, `insert into public.project_leveranciers (project_id, leverancier_id) values ($1, $2)`, [projectId, l!.id])
    await als(MICHIEL, `insert into public.project_disciplines (project_id, discipline, leverancier_id, contact) values ($1, 'lift', $2, 'Kees · 06 1234 5678')`, [projectId, l!.id])
    await expect(als(MICHIEL, `insert into public.project_disciplines (project_id, discipline) values ($1, 'Liften!')`, [projectId])).rejects.toThrow()
    await als(MICHIEL, `delete from public.project_leveranciers where project_id = $1 and leverancier_id = $2`, [projectId, l!.id])
    const [d] = await als<{ leverancier_id: string | null, contact: string }>(MICHIEL, `select leverancier_id, contact from public.project_disciplines where project_id = $1 and discipline = 'lift'`, [projectId])
    expect(d).toEqual({ leverancier_id: null, contact: 'Kees · 06 1234 5678' })
  })

  it('bewaart e-mailadressen van actiehouders, alleen geldige', async () => {
    await als(MICHIEL, `insert into public.adressen (naam, email) values ('Carlo', 'carlo@bbdw.nl')`)
    await expect(als(MICHIEL, `insert into public.adressen (naam, email) values ('Hugo', 'geen-adres')`)).rejects.toThrow()
    expect(await als(VREEMD, `select naam from public.adressen`)).toHaveLength(0)
  })

  it('logt wachtkamer, subfase en buddy op het project', async () => {
    const [p] = await als<{ id: string }>(MICHIEL, `insert into public.projecten (slug, naam) values ('wachtend', 'Wachtend') returning id`)
    await als(MICHIEL, `update public.projecten set wachtkamer = true, buddy = 'Ad' where id = $1`, [p!.id])
    await expect(als(MICHIEL, `update public.projecten set subfase = 'X O' where id = $1`, [p!.id])).rejects.toThrow()
    const log = await als<{ veld: string, nieuw: string }>(MICHIEL, `select veld, nieuw from public.logboek where project_id = $1 order by id`, [p!.id])
    expect(log).toEqual([{ veld: 'wachtkamer', nieuw: 'true' }, { veld: 'buddy', nieuw: 'Ad' }])
  })

  it('logt afgehandeld op het project', async () => {
    const [p] = await als<{ id: string, afgehandeld: boolean }>(MICHIEL, `insert into public.projecten (slug, naam, fase) values ('klaar', 'Klaar', 'nazorg') returning id, afgehandeld`)
    expect(p!.afgehandeld).toBe(false)
    await als(MICHIEL, `update public.projecten set afgehandeld = true where id = $1`, [p!.id])
    const log = await als<{ veld: string, nieuw: string }>(MICHIEL, `select veld, nieuw from public.logboek where project_id = $1 order by id`, [p!.id])
    expect(log).toEqual([{ veld: 'afgehandeld', nieuw: 'true' }])
  })

  it('bewaart feedback van een medewerker, met wie en wanneer; alleen het MT leest hem', async () => {
    await als(MICHIEL, `insert into public.feedback (tekst, pad, plek_x, plek_y, element, door) values ('Knop staat scheef', '/projecten/vlijtseweg', 120, 840, 'button.knop "Opslaan"', 'Vervalst')`)
    await expect(als(MICHIEL, `insert into public.feedback (tekst, pad, plek_x) values ('Alleen x', '/', 10)`)).rejects.toThrow()
    await expect(als(MICHIEL, `insert into public.feedback (tekst, pad) values ('   ', '/')`)).rejects.toThrow()
    await expect(als(VREEMD, `insert into public.feedback (tekst, pad) values ('Van buiten', '/')`)).rejects.toThrow()
    expect(await als(MICHIEL, `select id from public.feedback`)).toHaveLength(0)
    const rijen = await als<{ door: string, plek_y: number, afgehandeld: boolean }>(BENNO, `select door, plek_y, afgehandeld from public.feedback`)
    expect(rijen).toEqual([{ door: 'Michiel', plek_y: 840, afgehandeld: false }])
  })

  it('bewaart instellingen: iedereen leest, alleen het MT schrijft, met wie en wanneer', async () => {
    await expect(als(MICHIEL, `insert into public.instellingen (sleutel, waarde) values ('mensen', '{}')`)).rejects.toThrow()
    const [r] = await als<{ gewijzigd_door: string }>(BENNO, `insert into public.instellingen (sleutel, waarde, gewijzigd_door) values ('mensen', '{"eigenaren":["Anna"]}', 'Vervalst') returning gewijzigd_door`)
    expect(r!.gewijzigd_door).toBe('Benno van Bergen')
    await expect(als(BENNO, `insert into public.instellingen (sleutel, waarde) values ('iets', '{}')`)).rejects.toThrow()
    // De taken die uit het pakket gingen (beslissing 41): ook alleen het MT.
    await expect(als(MICHIEL, `insert into public.instellingen (sleutel, waarde) values ('vervallen', '{}')`)).rejects.toThrow()
    await als(BENNO, `insert into public.instellingen (sleutel, waarde) values ('vervallen', '{}')`)
    expect(await als(MICHIEL, `select sleutel from public.instellingen order by sleutel`)).toEqual([{ sleutel: 'mensen' }, { sleutel: 'vervallen' }])
    await als(BENNO, `delete from public.instellingen where sleutel = 'vervallen'`)
    expect(await als(MICHIEL, `select sleutel from public.instellingen`)).toEqual([{ sleutel: 'mensen' }])
    expect(await als(MICHIEL, `delete from public.instellingen returning sleutel`)).toHaveLength(0)
    expect(await als(VREEMD, `select sleutel from public.instellingen`)).toHaveLength(0)
  })

  it('laat nieuwe soorten, subfasen en disciplines toe, als korte code', async () => {
    const [p] = await als<{ id: string }>(MICHIEL, `insert into public.projecten (slug, naam, soort, subfase) values ('nieuwe-soort', 'Nieuwe soort', '{tk,huur_2}', 'do') returning id`)
    await expect(als(MICHIEL, `update public.projecten set soort = '{"Met spatie"}' where id = $1`, [p!.id])).rejects.toThrow()
    await als(MICHIEL, `insert into public.project_disciplines (project_id, discipline, contact) values ($1, 'dak', 'Kees')`, [p!.id])
    await expect(als(MICHIEL, `insert into public.project_disciplines (project_id, discipline) values ($1, 'Dak!')`, [p!.id])).rejects.toThrow()
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
    await als(MICHIEL, `update public.projecten set fase = 'uitvoering', postcode = '7311 AB', plaats = 'Apeldoorn-Zuid' where id = $1`, [projectId])
    const log = await als<{ veld: string, nieuw: string }>(MICHIEL, `select veld, nieuw from public.logboek where tabel = 'projecten' and project_id = $1 order by id`, [projectId])
    expect(log).toEqual([{ veld: 'fase', nieuw: 'uitvoering' }, { veld: 'postcode', nieuw: '7311 AB' }, { veld: 'plaats', nieuw: 'Apeldoorn-Zuid' }])
  })

  it('kent één projectnummer, uniek', async () => {
    const kolommen = await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'projecten'`)
    expect(kolommen.rows.map(r => r.column_name)).not.toContain('afas_nummer')
    await expect(als(MICHIEL, `insert into public.projecten (slug, naam, nummer) values ('dubbel', 'Dubbel', 'P20038')`)).rejects.toThrow()
  })

  it('laat een medewerker een lead aanmaken en logt de slagingskans', async () => {
    const [lead] = await als<{ id: string, fase: string }>(MICHIEL,
      `insert into public.projecten (slug, naam, am, slagingskans) values ('zorgplein-noord', 'Zorgplein Noord', 'Jeroen', 50) returning id, fase`)
    expect(lead!.fase).toBe('lead')
    await als(MICHIEL, `update public.projecten set slagingskans = 75 where id = $1`, [lead!.id])
    await expect(als(MICHIEL, `update public.projecten set slagingskans = 60 where id = $1`, [lead!.id])).rejects.toThrow()
    const log = await als<{ veld: string, oud: string, nieuw: string }>(MICHIEL, `select veld, oud, nieuw from public.logboek where project_id = $1`, [lead!.id])
    expect(log).toEqual([{ veld: 'slagingskans', oud: '50', nieuw: '75' }])
  })
})

describe('controle', () => {
  let leverancier: string
  let punt: string
  const koppel = (pid: string, lid: string) => als(MICHIEL, `insert into public.project_leveranciers (project_id, leverancier_id) values ($1, $2)`, [pid, lid])

  it('kent een globale lijst zonder dubbele namen, en leveranciers voor één project', async () => {
    const [l] = await als<{ id: string }>(MICHIEL, `insert into public.leveranciers (naam, vak, globaal) values ('Klimaattechniek Oost', 'Installateur', true) returning id`)
    leverancier = l!.id
    await koppel(projectId, leverancier)
    await expect(koppel(projectId, leverancier)).rejects.toThrow()
    await expect(als(MICHIEL, `insert into public.leveranciers (naam, globaal) values (' klimaattechniek oost', true)`)).rejects.toThrow()
    // Alleen voor één project mag dezelfde naam wel.
    expect(await als(MICHIEL, `insert into public.leveranciers (naam) values ('Klimaattechniek Oost') returning id`)).toHaveLength(1)
    expect(await als(VREEMD, `select id from public.leveranciers`)).toHaveLength(0)
    expect(await als(VREEMD, `select project_id from public.project_leveranciers`)).toHaveLength(0)
  })

  it('vult wie het punt maakte en wie het oploste, en laat de foto en de maker vastliggen', async () => {
    const [p] = await als<{ id: string, aangemaakt_door: string }>(MICHIEL,
      `insert into public.controlepunten (project_id, leverancier_id, notitie, foto, aangemaakt_door) values ($1, $2, 'Kitnaad niet afgewerkt', $3, 'Vervalst') returning id, aangemaakt_door`,
      [projectId, leverancier, `${projectId}/a.jpg`])
    punt = p!.id
    expect(p!.aangemaakt_door).toBe('Michiel')

    const [op] = await als<{ opgelost_door: string, foto: string, aangemaakt_door: string }>(BENNO,
      `update public.controlepunten set opgelost = true, foto = 'elders/b.jpg', aangemaakt_door = 'Benno' where id = $1 returning opgelost_door, foto, aangemaakt_door`, [punt])
    expect(op).toEqual({ opgelost_door: 'Benno van Bergen', foto: `${projectId}/a.jpg`, aangemaakt_door: 'Michiel' })

    const [weer] = await als<{ opgelost_door: string | null, opgelost_op: string | null }>(MICHIEL,
      `update public.controlepunten set opgelost = false where id = $1 returning opgelost_door, opgelost_op`, [punt])
    expect(weer).toEqual({ opgelost_door: null, opgelost_op: null })
  })

  it('staat een punt zonder leverancier toe, en een leverancier kiezen achteraf, alleen een van het project', async () => {
    const [p] = await als<{ id: string, leverancier_id: string | null }>(MICHIEL,
      `insert into public.controlepunten (project_id, notitie, foto) values ($1, 'Plafondplaat gang beschadigd', $2) returning id, leverancier_id`,
      [projectId, `${projectId}/c.jpg`])
    expect(p!.leverancier_id).toBeNull()
    const [na] = await als<{ leverancier_id: string }>(MICHIEL, `update public.controlepunten set leverancier_id = $2 where id = $1 returning leverancier_id`, [p!.id, leverancier])
    expect(na!.leverancier_id).toBe(leverancier)
    const [los] = await als<{ id: string }>(MICHIEL, `insert into public.leveranciers (naam) values ('Liften Zuid') returning id`)
    await expect(als(MICHIEL, `update public.controlepunten set leverancier_id = $2 where id = $1`, [p!.id, los!.id])).rejects.toThrow()
    await als(MICHIEL, `delete from public.controlepunten where id = $1`, [p!.id])
  })

  it('weigert een punt zonder foto in de projectmap, zonder notitie, of met een leverancier van een ander project', async () => {
    const insert = `insert into public.controlepunten (project_id, leverancier_id, notitie, foto) values ($1, $2, $3, $4)`
    await expect(als(MICHIEL, insert, [projectId, leverancier, 'Notitie', 'ergens/a.jpg'])).rejects.toThrow()
    await expect(als(MICHIEL, insert, [projectId, leverancier, ' ', `${projectId}/a.jpg`])).rejects.toThrow()
    const [ander] = (await db.query<{ id: string }>(`select id from public.projecten where id <> $1 limit 1`, [projectId])).rows
    await expect(als(MICHIEL, insert, [ander!.id, leverancier, 'Notitie', `${ander!.id}/a.jpg`])).rejects.toThrow()
  })

  it('haalt een leverancier met aandachtspunten niet van het project, en een leverancier op een project niet weg', async () => {
    const ontkoppel = () => als(MICHIEL, `delete from public.project_leveranciers where project_id = $1 and leverancier_id = $2`, [projectId, leverancier])
    const verwijder = () => als(MICHIEL, `delete from public.leveranciers where id = $1`, [leverancier])
    await expect(ontkoppel()).rejects.toThrow()
    await als(MICHIEL, `delete from public.controlepunten where id = $1`, [punt])
    await expect(verwijder()).rejects.toThrow()
    await ontkoppel()
    // Op geen project meer: dan mag hij weg, ook uit de globale lijst.
    await verwijder()
    expect(await als(MICHIEL, `select id from public.leveranciers where id = $1`, [leverancier])).toHaveLength(0)
    expect(await als(VREEMD, `delete from public.leveranciers returning id`)).toHaveLength(0)
  })

  it('maakt een besloten bucket voor de foto\'s, alleen voor medewerkers', async () => {
    const [b] = (await db.query<{ public: boolean }>(`select public from storage.buckets where id = 'controle'`)).rows
    expect(b!.public).toBe(false)
    await als(MICHIEL, `insert into storage.objects (bucket_id, name) values ('controle', $1)`, [`${projectId}/a.jpg`])
    expect(await als(MICHIEL, `select name from storage.objects where bucket_id = 'controle'`)).toHaveLength(1)
    expect(await als(VREEMD, `select name from storage.objects where bucket_id = 'controle'`)).toHaveLength(0)
    await expect(als(VREEMD, `insert into storage.objects (bucket_id, name) values ('controle', 'x/b.jpg')`)).rejects.toThrow()
  })
})

describe('tekeningen', () => {
  it('bewaart een tekening per project, met wie hem toevoegde', async () => {
    const [t] = await als<{ id: string, aangemaakt_door: string }>(MICHIEL,
      `insert into public.tekeningen (project_id, naam, pad) values ($1, 'Plattegrond begane grond', $2) returning id, aangemaakt_door`, [projectId, `${projectId}/bg.pdf`])
    expect(t!.aangemaakt_door).toBe('Michiel')
    await expect(als(MICHIEL, `insert into public.tekeningen (project_id, naam, pad) values ($1, 'Elders', 'ander/pad.pdf')`, [projectId])).rejects.toThrow()
    expect(await als(VREEMD, `select id from public.tekeningen`)).toHaveLength(0)
  })

  it('legt een plek vast op een tekening van het eigen project, compleet of helemaal niet', async () => {
    const [t] = await als<{ id: string }>(MICHIEL, `select id from public.tekeningen where project_id = $1`, [projectId])
    const insert = `insert into public.controlepunten (project_id, notitie, foto, tekening_id, tekening_blad, tekening_x, tekening_y) values ($1, 'Kitnaad', $2, $3, $4, $5, $6) returning id`
    const [p] = await als<{ id: string }>(MICHIEL, insert, [projectId, `${projectId}/k.jpg`, t!.id, 1, 0.42, 0.61])
    await expect(als(MICHIEL, insert, [projectId, `${projectId}/k.jpg`, t!.id, 1, 1.2, 0.5])).rejects.toThrow()
    await expect(als(MICHIEL, insert, [projectId, `${projectId}/k.jpg`, t!.id, null, 0.4, 0.5])).rejects.toThrow()
    const [ander] = (await db.query<{ id: string }>(`select id from public.projecten where id <> $1 limit 1`, [projectId])).rows
    await expect(als(MICHIEL, insert, [ander!.id, `${ander!.id}/k.jpg`, t!.id, 1, 0.4, 0.5])).rejects.toThrow()
    // Plek verplaatsen en weghalen kan; de tekening zelf kan niet weg zolang er een punt op staat.
    await als(MICHIEL, `update public.controlepunten set tekening_x = 0.5, tekening_y = 0.5 where id = $1`, [p!.id])
    await expect(als(MICHIEL, `delete from public.tekeningen where id = $1`, [t!.id])).rejects.toThrow()
    await als(MICHIEL, `update public.controlepunten set tekening_id = null, tekening_blad = null, tekening_x = null, tekening_y = null where id = $1`, [p!.id])
    await als(MICHIEL, `delete from public.tekeningen where id = $1`, [t!.id])
    expect(await als(MICHIEL, `select id from public.tekeningen where id = $1`, [t!.id])).toHaveLength(0)
  })

  it('maakt een besloten bucket alleen voor pdf\'s', async () => {
    const [b] = (await db.query<{ public: boolean, allowed_mime_types: string[] }>(`select public, allowed_mime_types from storage.buckets where id = 'tekeningen'`)).rows
    expect(b).toEqual({ public: false, allowed_mime_types: ['application/pdf'] })
    await als(MICHIEL, `insert into storage.objects (bucket_id, name) values ('tekeningen', $1)`, [`${projectId}/bg.pdf`])
    expect(await als(VREEMD, `select name from storage.objects where bucket_id = 'tekeningen'`)).toHaveLength(0)
  })
})

describe('deellinks', () => {
  const SERVER = { role: 'service_role' }
  const ANONIEM = { role: 'anon' }
  let leverancier: string
  let punt: string
  const maak = () => als<{ id: string, token: string, code: string, maand: boolean, aangemaakt_door: string }>(MICHIEL,
    `insert into public.deellinks (leverancier_id) values ($1) returning id, token, code, geldig_tot = aangemaakt_op + interval '1 month' as maand, aangemaakt_door`, [leverancier])
  const link = (id: string) => db.query<{ gesloten_reden: string | null, gesloten_door: string | null, gesloten_op: string | null, foute_pogingen: number, bekeken_op: string | null }>(
    `select gesloten_reden, gesloten_door, gesloten_op, foute_pogingen, bekeken_op from public.deellinks where id = $1`, [id]).then(r => r.rows[0]!)

  it('maakt een link alleen voor een leverancier met open punten', async () => {
    const [l] = await als<{ id: string }>(MICHIEL, `insert into public.leveranciers (naam, globaal) values ('Elektro Hendriks', true) returning id`)
    leverancier = l!.id
    await als(MICHIEL, `insert into public.project_leveranciers (project_id, leverancier_id) values ($1, $2)`, [projectId, leverancier])
    await expect(maak()).rejects.toThrow(/geen open aandachtspunten/)
    const [p] = await als<{ id: string }>(MICHIEL,
      `insert into public.controlepunten (project_id, leverancier_id, notitie, foto) values ($1, $2, 'Wandcontactdoos bij de balie zit los', $3) returning id`,
      [projectId, leverancier, `${projectId}/w.jpg`])
    punt = p!.id
  })

  it('zet token, code (alleen 2 tot 9) en een maand geldig zelf, wat de browser ook meestuurt', async () => {
    const [d] = await als<{ token: string, code: string, maand: boolean, aangemaakt_door: string }>(MICHIEL,
      `insert into public.deellinks (leverancier_id, token, code, geldig_tot) values ($1, $2, '22222', now() + interval '1 year')
       returning token, code, geldig_tot = aangemaakt_op + interval '1 month' as maand, aangemaakt_door`, [leverancier, 'a'.repeat(64)])
    expect(d!.token).toMatch(/^[0-9a-f]{64}$/)
    expect(d!.token).not.toBe('a'.repeat(64))
    expect(d!).toMatchObject({ maand: true, aangemaakt_door: 'Michiel' })
    const codes = []
    for (let i = 0; i < 40; i++) codes.push((await maak())[0]!.code)
    expect(codes.every(c => /^[2-9]{5}$/.test(c))).toBe(true)
    expect(new Set(codes.join(''))).toEqual(new Set('23456789'))
  })

  it('is alleen voor medewerkers te lezen, niet voor anonieme bezoekers of andere accounts', async () => {
    expect((await als(MICHIEL, `select id from public.deellinks`)).length).toBeGreaterThan(0)
    expect(await als(VREEMD, `select id from public.deellinks`)).toHaveLength(0)
    expect(await als(ANONIEM, `select id from public.deellinks`, [], 'anon')).toHaveLength(0)
    await expect(als(ANONIEM, `insert into public.deellinks (leverancier_id) values ($1)`, [leverancier], 'anon')).rejects.toThrow()
    await expect(als(MICHIEL, `delete from public.deellinks returning id`)).resolves.toHaveLength(0)
  })

  it('laat de code, de einddatum en wat de server bijhoudt niet aanpassen door medewerkers', async () => {
    const [d] = await maak()
    await als(MICHIEL, `update public.deellinks set code = '22222', geldig_tot = now() + interval '1 year', foute_pogingen = 0, bekeken_op = now() where id = $1`, [d!.id])
    const [na] = await als<{ code: string, maand: boolean }>(MICHIEL, `select code, geldig_tot = aangemaakt_op + interval '1 month' as maand from public.deellinks where id = $1`, [d!.id])
    expect(na).toEqual({ code: d!.code, maand: true })
    expect(await link(d!.id)).toMatchObject({ bekeken_op: null, foute_pogingen: 0 })
    // De server wel: een verkeerde code, en daarna bekeken.
    await als(SERVER, `update public.deellinks set foute_pogingen = 3 where id = $1`, [d!.id], 'service_role')
    expect((await link(d!.id)).foute_pogingen).toBe(3)
    await als(SERVER, `update public.deellinks set foute_pogingen = 0, bekeken_op = now() where id = $1`, [d!.id], 'service_role')
    const bekeken = await link(d!.id)
    expect(bekeken.foute_pogingen).toBe(0)
    expect(bekeken.bekeken_op).not.toBeNull()
  })

  it('trekt een link in, met wie en wanneer; dicht blijft dicht', async () => {
    const [d] = await maak()
    await als(BENNO, `update public.deellinks set gesloten_reden = 'ingetrokken', gesloten_door = 'Iemand anders' where id = $1`, [d!.id])
    expect(await link(d!.id)).toMatchObject({ gesloten_reden: 'ingetrokken', gesloten_door: 'Benno van Bergen' })
    await als(MICHIEL, `update public.deellinks set gesloten_reden = null, gesloten_op = null where id = $1`, [d!.id])
    expect((await link(d!.id)).gesloten_reden).toBe('ingetrokken')
  })

  it('gaat dicht zodra het laatste open punt van de leverancier is opgelost, en gaat niet vanzelf weer open', async () => {
    const [d] = await maak()
    await als(BENNO, `update public.controlepunten set opgelost = true where id = $1`, [punt])
    expect(await link(d!.id)).toMatchObject({ gesloten_reden: 'opgelost', gesloten_door: 'Benno van Bergen' })
    // De eerder ingetrokken link houdt zijn reden.
    expect((await als<{ gesloten_reden: string }>(MICHIEL, `select gesloten_reden from public.deellinks where gesloten_reden = 'ingetrokken'`)).length).toBeGreaterThan(0)
    await als(MICHIEL, `update public.controlepunten set opgelost = false where id = $1`, [punt])
    expect((await link(d!.id)).gesloten_reden).toBe('opgelost')
    expect(await als(MICHIEL, `select id from public.deellinks where gesloten_reden is null`)).toHaveLength(0)
  })

  it('sluit ook als het laatste punt naar een andere leverancier gaat of wordt weggehaald', async () => {
    const [d] = await maak()
    await als(MICHIEL, `update public.controlepunten set leverancier_id = null where id = $1`, [punt])
    expect((await link(d!.id)).gesloten_reden).toBe('opgelost')
    await als(MICHIEL, `update public.controlepunten set leverancier_id = $2 where id = $1`, [punt, leverancier])
    const [d2] = await maak()
    await als(MICHIEL, `delete from public.controlepunten where id = $1`, [punt])
    expect((await link(d2!.id)).gesloten_reden).toBe('opgelost')
  })
})

describe('proefversie', () => {
  it('is weg: geen tabel meer voor kopieën van deellinks', async () => {
    expect((await db.query(`select to_regclass('public.proef_deellinks') as t`)).rows).toEqual([{ t: null }])
  })
})

describe('opgelost melden (leverancier) en aftekenen (BbDW)', () => {
  const SERVER = { role: 'service_role' }
  let lev: string
  let punt: string
  let link: string
  const stand = (id: string) => db.query<{ opgelost: boolean, gereed_op: string | null, gereed_door: string | null, afgekeurd_door: string | null, afgekeurd_reden: string | null, opgelost_door: string | null }>(
    `select opgelost, gereed_op, gereed_door, afgekeurd_door, afgekeurd_reden, opgelost_door from public.controlepunten where id = $1`, [id]).then(r => r.rows[0]!)
  const linkReden = () => db.query<{ gesloten_reden: string | null }>(`select gesloten_reden from public.deellinks where id = $1`, [link]).then(r => r.rows[0]!.gesloten_reden)
  const meld = (gereed_door: string | null) => als(SERVER, `update public.controlepunten set gereed_door = $2 where id = $1`, [punt, gereed_door], 'service_role')

  it('laat alleen de leverancier (via de server) opgelost melden', async () => {
    const [l] = await als<{ id: string }>(MICHIEL, `insert into public.leveranciers (naam, globaal) values ('Schildersbedrijf Jansen', true) returning id`)
    lev = l!.id
    await als(MICHIEL, `insert into public.project_leveranciers (project_id, leverancier_id) values ($1, $2)`, [projectId, lev])
    const [p] = await als<{ id: string, gereed_op: string | null }>(MICHIEL,
      `insert into public.controlepunten (project_id, leverancier_id, notitie, foto, gereed_op, gereed_door) values ($1, $2, 'Verf op het glas', $3, now(), 'Nep') returning id, gereed_op`,
      [projectId, lev, `${projectId}/v.jpg`])
    punt = p!.id
    expect(p!.gereed_op).toBeNull()
    link = (await als<{ id: string }>(MICHIEL, `insert into public.deellinks (leverancier_id) values ($1) returning id`, [lev]))[0]!.id
    // Een medewerker kan niet namens de leverancier melden.
    await als(MICHIEL, `update public.controlepunten set gereed_op = now(), gereed_door = 'Schildersbedrijf Jansen' where id = $1`, [punt])
    expect((await stand(punt)).gereed_op).toBeNull()
    await meld('Schildersbedrijf Jansen')
    expect(await stand(punt)).toMatchObject({ opgelost: false, gereed_door: 'Schildersbedrijf Jansen' })
    expect((await stand(punt)).gereed_op).not.toBeNull()
    // Terugdraaien kan de leverancier zelf.
    await meld(null)
    expect((await stand(punt)).gereed_op).toBeNull()
  })

  it('afkeuren: weer open voor de leverancier, met wie en de reden', async () => {
    await meld('Schildersbedrijf Jansen')
    await als(BENNO, `update public.controlepunten set gereed_op = null, afgekeurd_reden = '  Nog strepen op het glas  ', afgekeurd_door = 'Nep' where id = $1`, [punt])
    expect(await stand(punt)).toMatchObject({ opgelost: false, gereed_op: null, gereed_door: null, afgekeurd_door: 'Benno van Bergen', afgekeurd_reden: 'Nog strepen op het glas' })
    expect(await linkReden()).toBeNull()
  })

  it('pas na het aftekenen is het punt opgelost en gaat de link dicht', async () => {
    await meld('Schildersbedrijf Jansen')
    expect(await linkReden()).toBeNull()
    await als(MICHIEL, `update public.controlepunten set opgelost = true where id = $1`, [punt])
    expect(await stand(punt)).toMatchObject({ opgelost: true, opgelost_door: 'Michiel', gereed_door: 'Schildersbedrijf Jansen' })
    expect(await linkReden()).toBe('opgelost')
    // Na het aftekenen kan de leverancier niets meer veranderen.
    await meld(null)
    expect((await stand(punt)).gereed_door).toBe('Schildersbedrijf Jansen')
  })

  it('weer open: de melding en de oude afkeuring vervallen', async () => {
    await als(MICHIEL, `update public.controlepunten set opgelost = false where id = $1`, [punt])
    expect(await stand(punt)).toMatchObject({ opgelost: false, gereed_op: null, gereed_door: null, afgekeurd_reden: null })
  })
})

describe('beveiliging', () => {
  const SERVER = { role: 'service_role' }
  // Anna zette bij het aanmaken van haar account een andere naam in het token.
  const ANNA = { sub: '00000000-0000-0000-0000-00000000000a', email: 'anna@bbdw.nl', app_metadata: { provider: 'email' }, user_metadata: { full_name: 'Benno van Bergen' }, amr: ingelogd() }
  const BART = { sub: '00000000-0000-0000-0000-00000000000b', email: 'bart@bbdw.nl', app_metadata: { provider: 'email' }, user_metadata: {}, amr: ingelogd() }

  it('bewaart geen wachtwoord, ook niet als Supabase er een zet', async () => {
    await db.query(`insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, $2, '$2a$vooraf', '{"full_name":"Benno van Bergen"}'), ($3, $4, null, '{}')`,
      [ANNA.sub, ANNA.email, BART.sub, BART.email])
    const wachtwoord = () => db.query<{ encrypted_password: string }>(`select encrypted_password from auth.users where id = $1`, [ANNA.sub]).then(r => r.rows[0]!.encrypted_password)
    expect(await wachtwoord()).toBe('')
    await db.query(`update auth.users set encrypted_password = '$2a$later' where id = $1`, [ANNA.sub])
    expect(await wachtwoord()).toBe('')
  })

  it('neemt de naam niet uit het token, en laat hem één keer kiezen, niet die van een ander', async () => {
    expect(await als(ANNA, `select public.wie() as wie`)).toEqual([{ wie: 'anna@bbdw.nl' }])
    await als(ANNA, `update public.profielen set naam = '  Anna   de Wit ' where id = $1`, [ANNA.sub])
    expect(await als(ANNA, `select public.wie() as wie`)).toEqual([{ wie: 'Anna de Wit' }])
    // Daarna niet meer zelf: niet even onder een andere naam aftekenen.
    expect(await als(ANNA, `update public.profielen set naam = 'Benno van Bergen' where id = $1 returning id`, [ANNA.sub])).toHaveLength(0)
    await expect(als(BART, `update public.profielen set naam = 'anna de wit' where id = $1`, [BART.sub])).rejects.toMatchObject({ code: '23505' })
    await expect(als(BART, `update public.profielen set naam = 'B' where id = $1`, [BART.sub])).rejects.toThrow()
    expect(await als({ ...BART, amr: ingelogd(8) }, `update public.profielen set naam = 'Bart' where id = $1 returning id`, [BART.sub])).toHaveLength(0)
  })

  it('laat op het project alleen links naar http(s) toe', async () => {
    await expect(als(MICHIEL, `update public.projecten set sharepoint_url = 'javascript:alert(1)' where id = $1`, [projectId])).rejects.toThrow()
    await expect(als(MICHIEL, `update public.projecten set extern_url = 'data:text/html,x' where id = $1`, [projectId])).rejects.toThrow()
    expect(await als(MICHIEL, `update public.projecten set notitieblok_url = 'https://bbdw.sharepoint.com/sites/P20038' where id = $1 returning id`, [projectId])).toHaveLength(1)
  })

  it('controleert de code van een deellink en telt in één keer; na tien verkeerde dicht', async () => {
    const [l] = await als<{ id: string }>(MICHIEL, `insert into public.leveranciers (naam, globaal) values ('Glaszetter Noord', true) returning id`)
    await als(MICHIEL, `insert into public.project_leveranciers (project_id, leverancier_id) values ($1, $2)`, [projectId, l!.id])
    await als(MICHIEL, `insert into public.controlepunten (project_id, leverancier_id, notitie, foto) values ($1, $2, 'Ruit gekrast', $3)`, [projectId, l!.id, `${projectId}/g.jpg`])
    const maak = async () => (await als<{ token: string, code: string }>(MICHIEL, `insert into public.deellinks (leverancier_id) values ($1) returning token, code`, [l!.id]))[0]!
    type Na = { klopt: boolean, foute_pogingen: number, gesloten_reden: string | null }
    const poging = async (token: string, code: string) => (await als<{ na: Na | null }>(SERVER, `select public.deellink_code($1, $2) as na`, [token, code], 'service_role'))[0]!.na
    const fout = (code: string) => (code === '22222' ? '33333' : '22222')

    const d = await maak()
    for (let i = 0; i < 9; i++) await poging(d.token, fout(d.code))
    expect(await poging(d.token, fout(d.code))).toMatchObject({ klopt: false, foute_pogingen: 10, gesloten_reden: 'geblokkeerd' })
    expect(await poging(d.token, d.code)).toMatchObject({ klopt: false, gesloten_reden: 'geblokkeerd' })

    const e = await maak()
    await poging(e.token, fout(e.code))
    expect(await poging(e.token, e.code)).toMatchObject({ klopt: true, foute_pogingen: 0, gesloten_reden: null })
    expect(await poging('0'.repeat(64), '22222')).toBeNull()
    // Alleen de server: een medewerker of anonieme bezoeker kan niet raden via de database.
    await expect(als(MICHIEL, `select public.deellink_code($1, $2)`, [e.token, e.code])).rejects.toThrow()
    await expect(als({ role: 'anon' }, `select public.deellink_code($1, $2)`, [e.token, e.code], 'anon')).rejects.toThrow()
  })

  it('geeft elke functie een vaste search_path', async () => {
    const zonder = await db.query<{ proname: string }>(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`)
    expect(zonder.rows.map(r => r.proname)).toEqual([])
  })
})
